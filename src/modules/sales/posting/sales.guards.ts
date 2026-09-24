import { Prisma } from '@prisma/client';
import {
  assertAccYearWritable,
  assertVoucherPartitionExists,
} from '../../accountsModule/receipt/receipt.guards';
import { SALES_ERROR_CODES, type SalesGuardContext } from './types/posting.types';
import { throwSalesLocked, throwSalesRefused, throwSalesRight } from './sales.errors';
import type { SalesSettings } from './sales.settings';

/**
 * §3.7 — flow §9's list, in order, as functions.
 *
 * Each either returns `void` or throws the CODED error. A WARN-level guard
 * pushes into `ctx.warnings[]` and throws only when its code is not in
 * `overrides[]` or the user may not override — and the server re-checks BOTH,
 * because a client that sends an override it has no right to is exactly the
 * case this exists for.
 *
 * `assertAccYearWritable` and `assertVoucherPartitionExists` are REUSED from
 * `receipt.guards.ts` rather than copied. A year that is writable for a
 * receipt and not for a bill would be a bug nobody could explain.
 *
 * ── One guard here replaces a FOREIGN KEY ──────────────────────────────────
 *
 * `assertSalesmen`. See its own note: PostgreSQL cannot put a foreign key on
 * the elements of an array, so nothing in the database will ever catch a bad
 * salesman id. That makes it not optional.
 */

export { assertAccYearWritable, assertVoucherPartitionExists };

export type SalesWriteClient = Prisma.TransactionClient;

// ═══════════════════════════════════════════════════════════════════════════
//  The WARN machinery — §1.5
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raise a WARN. It passes only when the request asked to override it AND the
 * user's `um_can_override` is true; otherwise it becomes a refusal — except on
 * `/validate` (`dryRun`), where an overridable WARN is reported as a WARN only.
 *
 * On `/validate` (`throwOnRefusal: false`) nothing throws at all and the whole
 * list comes back at once, which is the only way an operator can fix five
 * problems in one visit instead of five.
 */
export function warn(
  ctx: SalesGuardContext,
  code: string,
  message: string,
  opts: {
    field?: string;
    line?: number;
    overridable?: boolean;
    statutory?: SalesGuardContext['warnings'][number]['statutory'];
  } = {},
): void {
  const overridable = opts.overridable ?? true;
  const accepted = overridable && ctx.overrides.includes(code) && ctx.canOverride;

  ctx.warnings.push({
    code,
    level: accepted ? 'INFO' : 'WARN',
    message,
    field: opts.field,
    line: opts.line,
    overridable,
    statutory: opts.statutory,
  });

  // On /validate an overridable WARN stays a WARN: /post decides the override.
  if (accepted || (overridable && ctx.dryRun)) {
    return;
  }
  refuse(ctx, code, message, opts);
}

/** Record a refusal, and throw it unless this is a dry run. */
export function refuse(
  ctx: SalesGuardContext,
  code: string,
  message: string,
  opts: {
    field?: string;
    line?: number;
    statutory?: SalesGuardContext['refusals'][number]['statutory'];
  } = {},
): void {
  ctx.refusals.push({
    code,
    message,
    field: opts.field,
    line: opts.line,
    statutory: opts.statutory,
  });
  if (ctx.throwOnRefusal) {
    throwSalesRefused(message, code, opts.field ?? 'document', {
      ...(opts.line === undefined ? {} : { line: opts.line }),
      ...(opts.statutory === undefined ? {} : { statutory: opts.statutory }),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  1 — rights (flow §9 step 1)
// ═══════════════════════════════════════════════════════════════════════════

export type SalesRight = 'post' | 'cancel' | 'amend' | 'override' | 'retender';

const RIGHT_COLUMN: Record<SalesRight, string> = {
  post: 'um_can_post',
  cancel: 'um_can_cancel',
  amend: 'um_can_amend',
  override: 'um_can_override',
  retender: 'um_can_retender',
};

const RIGHT_CODE: Record<SalesRight, string> = {
  post: SALES_ERROR_CODES.RIGHT_POST,
  cancel: SALES_ERROR_CODES.RIGHT_CANCEL,
  amend: SALES_ERROR_CODES.RIGHT_AMEND,
  override: SALES_ERROR_CODES.RIGHT_OVERRIDE,
  retender: SALES_ERROR_CODES.RIGHT_RETENDER,
};

/** All four flags for this user on this menu, in one read. */
export async function loadRights(
  client: SalesWriteClient,
  userId: string,
  // `um_menu_id` is an INTEGER (fixed.menu_master.menu_id), not a uuid.
  menuId: number,
): Promise<Record<SalesRight, boolean>> {
  const rows = await client.$queryRaw<
    {
      um_can_post: boolean | null;
      um_can_cancel: boolean | null;
      um_can_amend: boolean | null;
      um_can_override: boolean | null;
      um_can_retender: boolean | null;
    }[]
  >`
    SELECT um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender
      FROM public.user_menus
     WHERE um_user_id    = ${userId}::uuid
       AND um_menu_id    = ${menuId}::int
       AND um_is_deleted = false
     LIMIT 1`;

  const row = rows[0];
  // No row means no rights. Defaulting a missing permission to TRUE is how a
  // permission system stops being one.
  return {
    post: row?.um_can_post ?? false,
    cancel: row?.um_can_cancel ?? false,
    amend: row?.um_can_amend ?? false,
    override: row?.um_can_override ?? false,
    retender: row?.um_can_retender ?? false,
  };
}

export async function assertRight(
  client: SalesWriteClient,
  userId: string,
  menuId: number,
  right: SalesRight,
): Promise<Record<SalesRight, boolean>> {
  const rights = await loadRights(client, userId, menuId);
  if (!rights[right]) {
    throwSalesRight(
      `This user may not ${right} on this menu (${RIGHT_COLUMN[right]} is false)`,
      RIGHT_CODE[right],
    );
  }
  return rights;
}

// ═══════════════════════════════════════════════════════════════════════════
//  3 — the calendar (flow §9 step 3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A document may not be dated in the future, and how far into the past it may
 * be dated is `sales.backdate_mode`.
 *
 * A future date is ALWAYS refused and is not a WARN at any setting: a bill
 * dated tomorrow files into a return period that has not begun.
 */
export function assertBackdate(
  ctx: SalesGuardContext,
  docDate: string,
  settings: SalesSettings,
  today = isoToday(),
  field = 'billDate',
): void {
  if (docDate > today) {
    refuse(
      ctx,
      SALES_ERROR_CODES.BACKDATE,
      `A document cannot be dated ${docDate}, which is in the future`,
      { field },
    );
    return;
  }
  if (docDate === today || settings.backdateMode === 'ALLOW') {
    return;
  }
  const message = `This document is dated ${docDate}, before today (${today})`;
  if (settings.backdateMode === 'REFUSE') {
    refuse(ctx, SALES_ERROR_CODES.BACKDATE, message, { field });
  } else {
    warn(ctx, SALES_ERROR_CODES.BACKDATE, message, { field });
  }
}

/**
 * Is this branch's day shut? Day close is on the LEDGER, not on the document:
 * an accountant closes a day's books and every module that posts into them is
 * closed with it.
 *
 * ── GAP, stated rather than faked ──────────────────────────────────────────
 *
 * **There is no day-close table on this database.** `sales_posting_flow.md` §9
 * step 3 and `HANDOVER_endpoints.md` (`locks.dayClosed`, `SALES_DAY_CLOSED`)
 * both require one, and nothing in `accounts` provides it — no `acc_day_close`,
 * no equivalent under another name.
 *
 * So this resolves the table at RUN TIME and answers `false` while it is
 * absent, rather than inventing a shape somebody would then have to migrate
 * away from. The moment a table called `accounts.acc_day_close` with
 * `adc_company_id / adc_branch_id / adc_close_date / adc_status` appears, this
 * starts enforcing with no code change. If it lands under a different shape,
 * THIS function is the one place to change.
 */
export async function loadDayClosed(
  client: SalesWriteClient,
  companyId: string,
  branchId: string,
  docDate: string,
): Promise<boolean> {
  const [exists] = await client.$queryRaw<{ tbl: string | null }[]>`
    SELECT to_regclass('accounts.acc_day_close')::text AS tbl`;
  if (!exists?.tbl) {
    return false;
  }

  // Unsafe only in name: no value is interpolated, the parameters are bound.
  const rows = await client.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n
       FROM accounts.acc_day_close
      WHERE adc_company_id = $1::uuid
        AND adc_branch_id  = $2::uuid
        AND adc_close_date = $3::date
        AND adc_is_deleted = false
        AND adc_status     = 'CLOSED'`,
    companyId,
    branchId,
    docDate,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function assertDayOpen(
  client: SalesWriteClient,
  companyId: string,
  branchId: string,
  docDate: string,
  field = 'billDate',
): Promise<void> {
  if (await loadDayClosed(client, companyId, branchId, docDate)) {
    // 409, not 422: the request is fine, the day is shut.
    throwSalesLocked(
      `The books for ${docDate} are closed at this branch`,
      SALES_ERROR_CODES.DAY_CLOSED,
      field,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  5 — the party (flow §9 step 5)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The three credit limits, all from `sales.customers`, all under
 * `sales.credit_limit_mode`:
 *
 *   `cus_credit_amt_limit`  — outstanding + this bill
 *   `cus_credit_bill_limit` — how many bills may be open at once
 *   `cus_credit_days`       — how old the oldest open bill may be
 *
 * Counted from `acc_bill_balance`, where the outstanding actually lives, and
 * never from `sale_bill`: a receipt allocated against a bill settles it there
 * and nowhere else.
 */
export async function assertCreditLimit(
  client: SalesWriteClient,
  ctx: SalesGuardContext,
  party: { custId: string; partyLedgerId: string },
  companyId: string,
  billAmount: number,
  settings: SalesSettings,
  docDate = isoToday(),
): Promise<void> {
  if (settings.creditLimitMode === 'OFF') {
    return;
  }

  const [limits] = await client.$queryRaw<
    {
      cus_credit_amt_limit: Prisma.Decimal | null;
      cus_credit_bill_limit: number | null;
      cus_credit_days: number | null;
    }[]
  >`
    SELECT cus_credit_amt_limit, cus_credit_bill_limit, cus_credit_days
      FROM sales.customers WHERE cus_id = ${party.custId}::uuid`;
  if (!limits) {
    return;
  }

  const [open] = await client.$queryRaw<
    { pending: Prisma.Decimal | null; bills: bigint; oldest: Date | null }[]
  >`
    SELECT SUM(abl_pending_amount)                AS pending,
           COUNT(*)                               AS bills,
           MIN(abl_doc_date)                      AS oldest
      FROM accounts.acc_bill_balance
     WHERE abl_company_id = ${companyId}::uuid
       AND abl_party_id   = ${party.partyLedgerId}::uuid
       AND abl_dr_cr      = 'DR'
       AND abl_status     = 'OPEN'
       AND abl_is_deleted = false`;

  const pending = Number(open?.pending ?? 0);
  const bills = Number(open?.bills ?? 0);
  const refuseIt = settings.creditLimitMode === 'REFUSE';
  const raise = refuseIt ? refuse : warn;

  const amtLimit = Number(limits.cus_credit_amt_limit ?? 0);
  if (amtLimit > 0 && pending + billAmount > amtLimit) {
    raise(
      ctx,
      SALES_ERROR_CODES.CREDIT_LIMIT,
      `Outstanding ${round2(pending)} plus this bill ${round2(billAmount)} exceeds the credit limit ${amtLimit}`,
      { field: 'custId' },
    );
  }

  const billLimit = limits.cus_credit_bill_limit ?? 0;
  if (billLimit > 0 && bills >= billLimit) {
    raise(
      ctx,
      SALES_ERROR_CODES.CREDIT_LIMIT,
      `This customer already has ${bills} open bills; the limit is ${billLimit}`,
      { field: 'custId' },
    );
  }

  const days = limits.cus_credit_days ?? 0;
  if (days > 0 && open?.oldest) {
    const age = daysBetween(open.oldest.toISOString().slice(0, 10), docDate);
    if (age > days) {
      raise(
        ctx,
        SALES_ERROR_CODES.CREDIT_LIMIT,
        `This customer's oldest open bill is ${age} days old; the limit is ${days}`,
        { field: 'custId' },
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  assertSalesmen — THE GUARD THAT REPLACES A FOREIGN KEY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `sb_salesman_id`, `so_salesman_id`, `sq_salesman_id`, `sr_salesman_id` and
 * `sdc_salesman_id` are all `uuid[]`, and **PostgreSQL cannot put a foreign
 * key on the ELEMENTS of an array.**
 *
 * So nothing in the database will ever catch an id that does not exist, is
 * soft-deleted, belongs to another company, or is simply a typo. This runs on
 * every create and every amend of all five documents, and it is not optional.
 *
 * Four things are checked, and each has its own way of going wrong:
 *
 *  * every element resolves in `public.employee_master`, is not deleted, and
 *    belongs to THIS company — a neighbouring company's salesman is a data
 *    leak as much as an error;
 *  * no duplicates, which would credit one person twice in the commission
 *    report;
 *  * the array is NULL or non-empty, never `{}` — an empty array reads as
 *    "there is a team" while naming nobody, and no report can tell the two
 *    apart afterwards;
 *  * **element 1 is the PRIMARY, by convention.** `abl_salesman_id` stays a
 *    single indexed `uuid` and takes `sb_salesman_id[1]`, so
 *    outstanding-by-salesman keeps its btree. The schema cannot enforce the
 *    ordering; the client must put the primary first.
 *
 * `loadman_id` is also `uuid[]` and keeps NO such convention: a load crew is
 * genuinely open-ended, nothing joins or indexes it, and there is no primary.
 * Pass `requirePrimary: false` for it — the ids are still validated.
 */
export async function assertSalesmen(
  client: SalesWriteClient,
  companyId: string,
  ids: string[] | null | undefined,
  opts: { field?: string; requirePrimary?: boolean } = {},
): Promise<void> {
  const field = opts.field ?? 'salesmanId';

  if (ids === null || ids === undefined) {
    return;
  }
  if (ids.length === 0) {
    throwSalesRefused(
      `${field} is an empty array — use null for "nobody", not {}`,
      SALES_ERROR_CODES.SALESMAN_INVALID,
      field,
    );
  }

  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throwSalesRefused(
        `${field} names ${id} twice — one person cannot be credited twice on one document`,
        SALES_ERROR_CODES.SALESMAN_INVALID,
        field,
      );
    }
    seen.add(id);
  }

  const found = await client.$queryRaw<{ emp_id: string }[]>`
    SELECT emp_id
      FROM public.employee_master
     WHERE emp_id         = ANY(${ids}::uuid[])
       AND emp_is_deleted = false
       AND emp_company_id = ${companyId}::uuid`;

  const live = new Set(found.map((r) => r.emp_id));
  const bad = ids.filter((id) => !live.has(id));
  if (bad.length > 0) {
    throwSalesRefused(
      `${field} names ${bad.length === 1 ? 'an employee' : 'employees'} that do not exist, ` +
        `are deleted, or belong to another company: ${bad.join(', ')}`,
      SALES_ERROR_CODES.SALESMAN_INVALID,
      field,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  8 — the money (flow §9 step 8)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Σ lines + charges − discounts + round-off = the bill amount, to the paisa.
 *
 * ±0.01, and NOT the ±0.50 tolerance 3.0 carried — `plan-backend-sales.md` §14
 * lists that tolerance among the things not to port. A rupee that does not add
 * up is a bug in whichever side computed it, and swallowing it hides the bug
 * while leaving the books out.
 */
export function assertBillAdds(
  ctx: SalesGuardContext,
  computed: number,
  declared: number,
  field = 'sbBillAmt',
): void {
  const diff = round2(computed - declared);
  if (Math.abs(diff) > 0.01) {
    refuse(
      ctx,
      SALES_ERROR_CODES.STOCK_QTY_MISMATCH,
      `The bill does not add up: the lines and charges make ${round2(computed)}, the bill says ${round2(declared)}`,
      { field },
    );
  }
}

/** Tenders may not exceed the bill unless `sales.allow_excess_tender`. */
export function assertTenderTotal(
  ctx: SalesGuardContext,
  tendered: number,
  billAmount: number,
  settings: SalesSettings,
  field = 'tenders',
): void {
  if (settings.allowExcessTender || round2(tendered) <= round2(billAmount)) {
    return;
  }
  warn(
    ctx,
    SALES_ERROR_CODES.TENDER_MIN_MAX,
    `Tenders total ${round2(tendered)} against a bill of ${round2(billAmount)}`,
    { field },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  The two derived locks — §1.3a. NEVER stored.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lock 2: once an IRN or an e-way bill is GENERATED, the document AND its
 * transport band are frozen, and amend is gone. Cancel is the only verb left.
 *
 * There is no third, partial state: an IRN with no e-way bill freezes the band
 * just as an e-way bill does, because the IRN payload carries `ShipDtls` /
 * `DispDtls` — it has already been declared either way.
 *
 * Computed from `gde_status` / `gdw_status` every time. A `ttd_is_locked`
 * column would be a second source of truth that drifts, which is the trap the
 * transition stamps already were.
 */
export async function loadDeclaredLocks(
  client: SalesWriteClient,
  gdrId: string | null,
): Promise<{ irnLive: boolean; ewbLive: boolean }> {
  if (!gdrId) {
    return { irnLive: false, ewbLive: false };
  }
  const [row] = await client.$queryRaw<{ irn_live: boolean; ewb_live: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM accounts.acc_voucher_doc_einvoice
                    WHERE gde_gdr_id = ${gdrId}::uuid AND gde_status = 'GENERATED') AS irn_live,
           EXISTS (SELECT 1 FROM accounts.acc_voucher_doc_ewaybill
                    WHERE gdw_gdr_id = ${gdrId}::uuid AND gdw_status = 'GENERATED') AS ewb_live`;
  return { irnLive: row?.irn_live ?? false, ewbLive: row?.ewb_live ?? false };
}

/**
 * Refuse an amend on a declared document.
 *
 * There is NO override and no right that unlocks this — not `rights.amend`,
 * not `sales.allow_posted_amend`. A declared document is corrected by
 * CANCELLING it inside the portal's own window and raising a fresh one; past
 * that window a sale bill is corrected by a credit note, never by an
 * amendment. That is GST's rule, not ours.
 */
export async function assertAmendable(
  client: SalesWriteClient,
  gdrId: string | null,
): Promise<void> {
  const { irnLive, ewbLive } = await loadDeclaredLocks(client, gdrId);
  if (irnLive) {
    throwSalesLocked(
      'This document has a live IRN and cannot be amended — cancel it at the portal and raise a fresh one, or issue a credit note',
      SALES_ERROR_CODES.IRN_LIVE,
      'sbId',
    );
  }
  if (ewbLive) {
    throwSalesLocked(
      'This document has a live e-way bill and cannot be amended — cancel it at the portal and raise a fresh one',
      SALES_ERROR_CODES.EWB_LIVE,
      'sbId',
    );
  }
}

/** Any write to the transport band once anything has been declared. */
export async function assertBandWritable(
  client: SalesWriteClient,
  gdrId: string | null,
): Promise<void> {
  const { irnLive, ewbLive } = await loadDeclaredLocks(client, gdrId);
  if (irnLive || ewbLive) {
    throwSalesLocked(
      'The transport details have already been declared and cannot be edited — a later vehicle change is a portal operation (POST /gst/ewaybill/vehicle)',
      SALES_ERROR_CODES.DECLARED_LOCKED,
      'transport',
    );
  }
}

/**
 * Lock 1 and the two document locks of flow §11: a return locks its bill, and
 * an allocation against its balance row locks it too.
 *
 * "Allocation" means a receipt has been applied to this bill. Its own set-offs
 * — the advance and credit-note adjustments the bill wrote for itself — do not
 * count, or a bill could never be cancelled at all.
 */
export async function assertCancellable(
  client: SalesWriteClient,
  bill: { billId: string; accYear: string; companyId: string },
): Promise<void> {
  const [row] = await client.$queryRaw<{ returns: bigint; allocations: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM sales.sale_return r
        WHERE r.sr_bill_id    = ${bill.billId}::uuid
          AND r.sr_is_deleted = false
          AND r.sr_status <> 'CANCELLED')                                   AS returns,
      (SELECT COUNT(*) FROM accounts.acc_bill_adjustment j
         JOIN accounts.acc_bill_balance b
           ON b.abl_id       = j.abj_bill_id
          AND b.abl_acc_year = j.abj_bill_acc_year
        WHERE b.abl_src_doc_id = ${bill.billId}::uuid
          AND b.abl_acc_year   = ${bill.accYear}::char(9)
          AND j.abj_is_deleted = false
          -- The bill's OWN set-offs are not somebody else's allocation. /post
          -- writes them (bill-adjustment.helper) as ADVANCE_ADJUST /
          -- NOTE_ADJUST with no voucher: the invoice-side row names the ADVANCE
          -- as abj_against_bill_id, so matching on the bill's own id never
          -- excluded anything. A receipt's rows always carry its voucher.
          AND NOT (j.abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST')
                   AND j.abj_voucher_id IS NULL))                           AS allocations`;

  if (Number(row?.returns ?? 0) > 0) {
    throwSalesLocked(
      'A sale return has been raised against this bill — cancel the return first',
      SALES_ERROR_CODES.RETURN_LOCKS_BILL,
      'sbId',
    );
  }
  if (Number(row?.allocations ?? 0) > 0) {
    throwSalesLocked(
      'A receipt or credit note has been allocated against this bill — cancel that first',
      SALES_ERROR_CODES.ALLOCATION_LOCKS_BILL,
      'sbId',
    );
  }
}

// ─── small shared helpers ───────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
