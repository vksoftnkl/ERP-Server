import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR, throwStockUnprocessable } from 'src/common/utils/module-service.utils';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { VoucherLeg } from '../../../common/posting/voucher-leg.types';
import type { SettledShortRow } from '../stock-voucher/stock-voucher-posting.helper';
import type {
  StockErrorDetail,
  StockErrorResponse,
  StockVoucherType,
} from '../stock-voucher/types/stock-voucher.types';
import { StockCogsModeService, type CogsModeResolver } from './stock-cogs-mode.service';

/** The DI token for the cogs-mode resolver, so a test can hand in a literal. */
export const STOCK_COGS_MODE = Symbol('STOCK_COGS_MODE');

/**
 * `avh_src_module` for every voucher this service writes. The link to the stock
 * document is (`STOCK`, `svh_voucher_type`, `svh_id`, year) — `ux_avh_src` keys
 * on exactly that, so one document can never carry two live vouchers.
 */
export const STOCK_ACCOUNTS_SRC_MODULE = 'STOCK';

/**
 * accounts.acc_voucher_types for the two stock documents whose screens number
 * their refno from the same row (`refnoVchrTypeId`), so the accounts voucher
 * and the stock document print the SAME number.
 */
const STOCK_VOUCHER_TYPE_ID: Partial<Record<StockVoucherType, number>> = {
  OPENING: 1,
  PHYSICAL: 6,
};

/**
 * The adjustment family (ADJUSTMENT, ISSUE, DAMAGE, EXPIRY_WRITEOFF) shares one
 * Stock Journal type, looked up by CODE: the id is a sequence value and differs
 * between databases (migration 20260928150000).
 */
const STOCK_ADJUSTMENT_VOUCHER_TYPE_CODE = 'StkAdj';
const ADJUSTMENT_FAMILY: ReadonlySet<StockVoucherType> = new Set([
  'ADJUSTMENT',
  'ISSUE',
  'DAMAGE',
  'EXPIRY_WRITEOFF',
]);

/**
 * A RE-LOT pair (adjustments plan §2, §5) carries the same value out of the
 * wrong lot and into the right one: nothing was gained or lost, so its rows
 * post NO leg. Recognised by the reason codes the seed ships.
 */
const RELOT_REASON_CODES = ['RELOT_OUT', 'RELOT_IN'];

/** The voucher type a transit short-settlement is numbered in — a Journal. */
const SHORT_SETTLE_VOUCHER_TYPE_CODE = 'Jrl';

/** The ledger roles a stock document posts to (seeded by migration 20260928100000). */
export const STOCK_LEDGER_ROLES = {
  INVENTORY: 'INVENTORY',
  OPENING_DIFFERENCE: 'OPENING_DIFFERENCE',
  STOCK_SHORTAGE: 'STOCK_SHORTAGE',
  STOCK_EXCESS: 'STOCK_EXCESS',
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `accounts.acc_voucher_header.avh_voucher_refno` is varchar(50). */
const VOUCHER_REFNO_MAX = 50;

export interface StockAccountsPostInput {
  svhId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  voucherType: StockVoucherType;
  displayName: string;
  actor: string;
  postedOn: Date;
}

export interface StockAccountsPostResult {
  voucherId: string;
  voucherRefno: string | null;
  amount: number;
  legCount: number;
}

interface StockHeaderRow {
  svh_refno: string;
  svh_doc_date: Date;
  svh_tenant_id: string | null;
  svh_device_id: string;
  svh_session_id: string | null;
  svh_created_by: string | null;
  svh_reason_id: string | null;
  reason_ledger_id: string | null;
}

/**
 * §1.9 — STOCK → ACCOUNTS, under PERPETUAL.
 *
 * WHY. `accounts.cogs_mode` = PERPETUAL, and the sale bill, DC and returns
 * already write DR COGS / CR INVENTORY. Every sale credits the Stock-in-Hand
 * ledger; nothing in the stock module ever debited it, so the ledger ran
 * negative and never equalled the stock valuation. Now:
 *
 *   OPENING    DR INVENTORY / CR OPENING_DIFFERENCE, value = Σ OPENING rows
 *   PHYSICAL   shortage: DR reason ledger (default role STOCK_SHORTAGE) / CR INVENTORY
 *              excess:   DR INVENTORY / CR reason ledger (default role STOCK_EXCESS)
 *              one voucher, both pairs, netted per ledger
 *   ADJUSTMENT / ISSUE / DAMAGE / EXPIRY_WRITEOFF   the same, on the 'StkAdj'
 *              Stock Journal type; a RELOT_OUT / RELOT_IN pair posts nothing
 *   TRANSFER   none within one company: one company-level Stock-in-Hand ledger
 *   settle-short   DR reason ledger / CR INVENTORY for short × stt_cost_rate
 *   ISSUE / RECEIPT behind a sales document   none — the sales document posts
 *              its own COGS pair, and posting here too would count it twice
 *
 * THE AMOUNT ALWAYS COMES FROM THE LEDGER ROWS THE POST JUST WROTE
 * (`sml_cost_value`), never from the payload. That way accounts and stock
 * cannot disagree.
 *
 * WHICH LEDGER: the line's reason, then the header's (`srm_gl_ledger_id`,
 * already folded onto `sml_reason_id`), when set; otherwise the role, through
 * `acc_ledger_map` — resolved by `VoucherPostingService.resolveLegLedgers`
 * like every other leg.
 *
 * Drafts never reach `acc_voucher_header`. A cancel calls `reverseLegs`, the
 * live `Rev` pattern, dated the original. Under PERIODIC nothing is written.
 */
@Injectable()
export class StockAccountsPostingService {
  private readonly logger = new Logger(StockAccountsPostingService.name);

  constructor(
    private readonly voucherPosting: VoucherPostingService,
    @Inject(STOCK_COGS_MODE) private readonly cogs: CogsModeResolver,
  ) {}

  /** Does this document type post a leg at all? */
  static postsAccounts(voucherType: StockVoucherType): boolean {
    return voucherType in STOCK_VOUCHER_TYPE_ID || ADJUSTMENT_FAMILY.has(voucherType);
  }

  /**
   * Write the accounts voucher for a stock document that just POSTED. Returns
   * null when nothing is to be written — PERIODIC, a type that posts no leg,
   * or a document whose rows sum to zero (a count where every line agreed).
   */
  async postForVoucher(
    tx: Prisma.TransactionClient,
    input: StockAccountsPostInput,
  ): Promise<StockAccountsPostResult | null> {
    if (!StockAccountsPostingService.postsAccounts(input.voucherType)) {
      return null;
    }
    if ((await this.cogs.cogsMode(input.companyId, input.branchId)) !== 'PERPETUAL') {
      return null;
    }
    const voucherTypeId =
      STOCK_VOUCHER_TYPE_ID[input.voucherType] ??
      (await this.voucherTypeIdByCode(tx, STOCK_ADJUSTMENT_VOUCHER_TYPE_CODE));
    const header = await this.header(tx, input.svhId, input.accYear);
    // A count and every adjustment-family document post the same way: each
    // ledger row is a shortage (DR reason / CR INVENTORY) or an excess (the
    // other way), netted per ledger. Only the re-lot pair is left out.
    const legs =
      input.voucherType === 'OPENING'
        ? await this.openingLegs(tx, input)
        : await this.varianceLegs(tx, input, header.reason_ledger_id);
    if (legs.length === 0) {
      return null;
    }
    const amount = legs.filter((l) => l.drCr === 'DR').reduce((s, l) => s + l.amount, 0);
    const posted = await this.voucherPosting.postLegs(tx, {
      header: {
        companyId: input.companyId,
        branchId: input.branchId,
        tenantId: header.svh_tenant_id,
        accYear: input.accYear,
        voucherTypeId,
        voucherDate: isoDate(header.svh_doc_date),
        srcModule: STOCK_ACCOUNTS_SRC_MODULE,
        srcDocType: input.voucherType,
        srcDocId: input.svhId,
        docLabel: input.displayName,
        docRefno: header.svh_refno,
        docDate: isoDate(header.svh_doc_date),
        docAmount: round2(amount),
        partyId: null,
        userId: this.userFor(input.actor, header.svh_created_by, input.displayName),
        sessionId: header.svh_session_id,
        deviceId: header.svh_device_id,
        remarks: `${input.displayName} ${header.svh_refno}`,
        // The same number the stock document prints, when the document drew it
        // from the accounts series (OPN0001 — `refnoVchrTypeId`). A device-
        // scheme refno (OPN/2026-2027/TILL-01/1) is the stock document's own
        // and can exceed avh_voucher_refno's 50 characters, so the voucher
        // then draws its own number from the type's series and links back
        // through avh_doc_refno instead.
        presetRefno: header.svh_refno.length <= VOUCHER_REFNO_MAX ? header.svh_refno : undefined,
        createdBy: input.actor === DEFAULT_ACTOR ? 'SYSTEM' : input.actor,
      },
      legs,
    });
    this.logger.log(
      `${input.displayName} ${header.svh_refno}: accounts voucher ${posted.voucherRefno} — ${posted.legCount} legs, ${round2(amount)}`,
    );
    return {
      voucherId: posted.voucherId,
      voucherRefno: posted.voucherRefno,
      amount: round2(amount),
      legCount: posted.legCount,
    };
  }

  /**
   * The mirror of the document's voucher, dated the original. A document that
   * never had one (PERIODIC, or posted before §1.9 landed) is a no-op.
   */
  async reverseForVoucher(
    tx: Prisma.TransactionClient,
    input: {
      svhId: string;
      accYear: string;
      companyId: string;
      voucherType: StockVoucherType;
      reason: string;
      actor: string;
    },
  ): Promise<{ voucherId: string; legCount: number } | null> {
    const [live] = await tx.$queryRaw<{ avh_voucher_id: string }[]>`
      SELECT avh_voucher_id
        FROM accounts.acc_voucher_header
       WHERE avh_company_id   = ${input.companyId}::uuid
         AND avh_src_module   = ${STOCK_ACCOUNTS_SRC_MODULE}
         AND avh_src_doc_type = ${input.voucherType}
         AND avh_src_doc_id   = ${input.svhId}::uuid
         AND avh_acc_year     = ${input.accYear}::char(9)
         AND avh_is_deleted   = false
         AND avh_voucher_status = 'POSTED'
       LIMIT 1`;
    if (!live) {
      return null;
    }
    return this.voucherPosting.reverseLegs(
      tx,
      live.avh_voucher_id,
      input.accYear,
      input.reason,
      input.actor === DEFAULT_ACTOR ? 'SYSTEM' : input.actor,
    );
  }

  /**
   * DR the reason's ledger / CR INVENTORY for what left branch A and never
   * arrived at B: without this entry the Stock-in-Hand ledger keeps a value no
   * stock stands behind (§1.1 settle-short). Numbered as a Journal, linked to
   * the OUT through `avh_src_*`.
   */
  async postShortSettlement(
    tx: Prisma.TransactionClient,
    input: {
      outId: string;
      outAccYear: string;
      companyId: string;
      branchId: string;
      refno: string;
      reasonId: string;
      remarks: string | null;
      rows: SettledShortRow[];
      actor: string;
      settledOn: Date;
    },
  ): Promise<StockAccountsPostResult | null> {
    if ((await this.cogs.cogsMode(input.companyId, input.branchId)) !== 'PERPETUAL') {
      return null;
    }
    const total = input.rows.reduce((s, r) => s.plus(r.shortValue), new Prisma.Decimal(0));
    if (total.lte(0)) {
      return null;
    }
    const [reason] = await tx.$queryRaw<{ srm_gl_ledger_id: string | null; srm_name: string }[]>`
      SELECT srm_gl_ledger_id, srm_name FROM stock.stock_reason_master
       WHERE srm_id = ${input.reasonId}::uuid AND srm_is_deleted = false`;
    if (!reason) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Reason not found', [
        { field: 'reasonId', message: `No stock reason ${input.reasonId}.` },
      ]);
    }
    const journal = { vchr_type_id: await this.voucherTypeIdByCode(tx, SHORT_SETTLE_VOUCHER_TYPE_CODE) };
    const [header] = await tx.$queryRaw<
      { svh_doc_date: Date; svh_tenant_id: string | null; svh_device_id: string; svh_session_id: string | null; svh_created_by: string | null }[]
    >`
      SELECT svh_doc_date, svh_tenant_id, svh_device_id, svh_session_id, svh_created_by
        FROM stock.stock_voucher
       WHERE svh_id = ${input.outId}::uuid AND svh_acc_year = ${input.outAccYear}::bpchar`;
    const amount = round2(total.toNumber());
    const legs: VoucherLeg[] = [
      {
        ...(reason.srm_gl_ledger_id
          ? { ledgerId: reason.srm_gl_ledger_id }
          : { role: STOCK_LEDGER_ROLES.STOCK_SHORTAGE }),
        roleTag: STOCK_LEDGER_ROLES.STOCK_SHORTAGE,
        drCr: 'DR',
        amount,
        remarks: `${reason.srm_name}: transit short on ${input.refno}`,
        field: 'reasonId',
      },
      {
        role: STOCK_LEDGER_ROLES.INVENTORY,
        roleTag: STOCK_LEDGER_ROLES.INVENTORY,
        drCr: 'CR',
        amount,
        remarks: `Transit short on ${input.refno}`,
        field: 'reasonId',
      },
    ];
    const posted = await this.voucherPosting.postLegs(tx, {
      header: {
        companyId: input.companyId,
        branchId: input.branchId,
        tenantId: header?.svh_tenant_id ?? null,
        accYear: input.outAccYear,
        voucherTypeId: journal.vchr_type_id,
        voucherDate: isoDate(input.settledOn),
        srcModule: STOCK_ACCOUNTS_SRC_MODULE,
        srcDocType: 'TRANSFER_OUT',
        srcDocId: input.outId,
        docLabel: 'Stock transfer short settlement',
        docRefno: input.refno,
        docDate: header ? isoDate(header.svh_doc_date) : isoDate(input.settledOn),
        docAmount: amount,
        partyId: null,
        userId: this.userFor(input.actor, header?.svh_created_by ?? null, 'Transit short settlement'),
        sessionId: header?.svh_session_id ?? null,
        deviceId: header?.svh_device_id ?? null,
        remarks: input.remarks ?? `Transit short on ${input.refno}`,
        createdBy: input.actor === DEFAULT_ACTOR ? 'SYSTEM' : input.actor,
      },
      legs,
    });
    return {
      voucherId: posted.voucherId,
      voucherRefno: posted.voucherRefno,
      amount,
      legCount: posted.legCount,
    };
  }

  /** DR INVENTORY / CR OPENING_DIFFERENCE, Σ of the document's forward rows. */
  private async openingLegs(
    tx: Prisma.TransactionClient,
    input: StockAccountsPostInput,
  ): Promise<VoucherLeg[]> {
    const [sum] = await tx.$queryRaw<{ value: Prisma.Decimal | null }[]>`
      SELECT SUM(sml.sml_cost_value) AS value
        FROM stock.stock_ledger sml
       WHERE sml.sml_src_doc_id  = ${input.svhId}::uuid
         AND sml.sml_acc_year    = ${input.accYear}::bpchar
         AND sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = false`;
    const amount = round2(Number(sum?.value ?? 0));
    if (amount === 0) {
      return [];
    }
    return [
      {
        role: STOCK_LEDGER_ROLES.INVENTORY,
        roleTag: STOCK_LEDGER_ROLES.INVENTORY,
        drCr: 'DR',
        amount,
        remarks: 'Opening stock',
        field: 'lines',
      },
      {
        role: STOCK_LEDGER_ROLES.OPENING_DIFFERENCE,
        roleTag: STOCK_LEDGER_ROLES.OPENING_DIFFERENCE,
        drCr: 'CR',
        amount,
        remarks: 'Opening stock',
        field: 'lines',
      },
    ];
  }

  /** accounts.acc_voucher_types by code — the id is a sequence value and differs between databases. */
  private async voucherTypeIdByCode(tx: Prisma.TransactionClient, code: string): Promise<number> {
    const [row] = await tx.$queryRaw<{ vchr_type_id: number }[]>`
      SELECT vchr_type_id FROM accounts.acc_voucher_types
       WHERE vchr_type_code = ${code} AND vchr_is_active = true LIMIT 1`;
    if (!row) {
      throw new Error(`Voucher type '${code}' is missing — apply the migration that seeds it`);
    }
    return row.vchr_type_id;
  }

  /**
   * Shortage rows DR the reason ledger and CR INVENTORY; excess rows the other
   * way. Summed per (direction, reason ledger) in the database, then NETTED per
   * ledger here, so a count that is short on one shelf and over on another of
   * the same reason — or an adjustment sheet with ten shortage lines — posts
   * one figure, not two that cancel. A re-lot pair's rows are left out: the
   * value left the wrong lot and arrived in the right one.
   */
  private async varianceLegs(
    tx: Prisma.TransactionClient,
    input: StockAccountsPostInput,
    headerReasonLedgerId: string | null,
  ): Promise<VoucherLeg[]> {
    const rows = await tx.$queryRaw<
      { sml_direction: number; reason_ledger_id: string | null; value: Prisma.Decimal | null }[]
    >`
      SELECT sml.sml_direction, srm.srm_gl_ledger_id AS reason_ledger_id, SUM(sml.sml_cost_value) AS value
        FROM stock.stock_ledger sml
        LEFT JOIN stock.stock_reason_master srm ON srm.srm_id = sml.sml_reason_id
       WHERE sml.sml_src_doc_id  = ${input.svhId}::uuid
         AND sml.sml_acc_year    = ${input.accYear}::bpchar
         AND sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = false
         AND (srm.srm_code IS NULL OR srm.srm_code <> ALL(${RELOT_REASON_CODES}::text[]))
       GROUP BY sml.sml_direction, srm.srm_gl_ledger_id`;
    // key → signed amount (DR positive, CR negative)
    const net = new Map<string, { leg: Omit<VoucherLeg, 'drCr' | 'amount'>; amount: number }>();
    const add = (key: string, leg: Omit<VoucherLeg, 'drCr' | 'amount'>, signed: number) => {
      const cur = net.get(key);
      if (cur) {
        cur.amount = round2(cur.amount + signed);
      } else {
        net.set(key, { leg, amount: round2(signed) });
      }
    };
    for (const r of rows) {
      const value = round2(Number(r.value ?? 0));
      if (value === 0) {
        continue;
      }
      const shortage = Number(r.sml_direction) < 0;
      const ledgerId = r.reason_ledger_id ?? headerReasonLedgerId;
      const role = shortage ? STOCK_LEDGER_ROLES.STOCK_SHORTAGE : STOCK_LEDGER_ROLES.STOCK_EXCESS;
      const reasonKey = ledgerId ? `L:${ledgerId}` : `R:${role}`;
      add(
        reasonKey,
        {
          ...(ledgerId ? { ledgerId } : { role }),
          roleTag: role,
          remarks: shortage ? `${input.displayName}: stock out` : `${input.displayName}: stock in`,
          field: 'reasonId',
        },
        shortage ? value : -value,
      );
      add(
        `R:${STOCK_LEDGER_ROLES.INVENTORY}`,
        {
          role: STOCK_LEDGER_ROLES.INVENTORY,
          roleTag: STOCK_LEDGER_ROLES.INVENTORY,
          remarks: `${input.displayName} ${input.svhId}`.slice(0, 250),
          field: 'lines',
        },
        shortage ? -value : value,
      );
    }
    const legs: VoucherLeg[] = [];
    for (const { leg, amount } of net.values()) {
      if (amount === 0) {
        continue;
      }
      legs.push({ ...leg, drCr: amount > 0 ? 'DR' : 'CR', amount: Math.abs(amount) });
    }
    return legs;
  }

  private async header(
    tx: Prisma.TransactionClient,
    svhId: string,
    accYear: string,
  ): Promise<StockHeaderRow> {
    const [row] = await tx.$queryRaw<StockHeaderRow[]>`
      SELECT svh.svh_refno, svh.svh_doc_date, svh.svh_tenant_id, svh.svh_device_id, svh.svh_session_id,
             svh.svh_created_by, svh.svh_reason_id, srm.srm_gl_ledger_id AS reason_ledger_id
        FROM stock.stock_voucher svh
        LEFT JOIN stock.stock_reason_master srm ON srm.srm_id = svh.svh_reason_id
       WHERE svh.svh_id = ${svhId}::uuid AND svh.svh_acc_year = ${accYear}::bpchar`;
    if (!row) {
      throw new Error(`Stock voucher ${svhId} (${accYear}) not found for accounts posting`);
    }
    return row;
  }

  /**
   * `avh_user_id` is NOT NULL with a foreign key to user_master, so the nil
   * actor cannot be written. The document's own author stands in; a document
   * with neither is refused rather than posted under a made-up user.
   */
  private userFor(actor: string, createdBy: string | null, what: string): string {
    if (UUID.test(actor) && actor !== DEFAULT_ACTOR) {
      return actor;
    }
    if (createdBy && UUID.test(createdBy) && createdBy !== DEFAULT_ACTOR) {
      return createdBy;
    }
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      `${what} cannot be posted to accounts`,
      [
        {
          field: 'userId',
          message: 'The accounts voucher needs a user to be posted by, and this request carries none.',
        },
      ],
    );
  }
}

/** DI provider: the real cogs-mode resolver behind the token. */
export const STOCK_COGS_MODE_PROVIDER = {
  provide: STOCK_COGS_MODE,
  useExisting: StockCogsModeService,
};

function round2(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
