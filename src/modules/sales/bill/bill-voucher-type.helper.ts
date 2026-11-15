import { Prisma } from '@prisma/client';
import {
  throwConflict,
  throwForbidden,
  throwUnprocessable,
} from 'src/common/utils/module-shared.utils';
import {
  PRINT_DESIGN_ASSIGNMENT_RULE,
  PRINT_DESIGN_LAYOUT_RULE,
  PRINT_DESIGN_LIVE_RULE,
  printDesignRuleSql,
} from '../../settings/print-template-assignment/print-design-usable.sql';
import { SALES_VOUCHER_TYPE } from '../posting/sales-doc.utils';
import type { BillErrorDetail } from './types/bill-api.types';

/**
 * The Sales Bill's voucher type (Voucher Types plan
 * Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md §5.3 / §5.4 / §7.4):
 * Sales Bill (3) itself, or one of the company's CHILD types of 3 (Retail,
 * Wholesale …). The bill is numbered from that type's counter and posts under it.
 * A company with no active child bills exactly as before: type 3, no setting read.
 *
 * An offline site (isOfflineSite, decision 64) bills plain Sales Bill (3) only:
 * the choices offer no child, and a save / validate / post that names a child
 * type (sent, or stored on the bill) is refused VT_OFFLINE. Until a cloud-to-site
 * sync exists a site cannot hold the company's children; one restored from a
 * cloud dump would otherwise bill them on its own branch counter (re-review R2).
 */

/** The base every bill type sits under. */
export const BILL_BASE_VCHR_TYPE_ID = SALES_VOUCHER_TYPE.BILL;
/** COMPANY, BOOL: offer Sales Bill itself once the company has children (Q3, decision 33). */
export const OFFER_BASE_BILL_TYPE_KEY = 'sales.offer_base_bill_type';
/** DEVICE, INT: the counter's default type on new bills (Q4). */
export const BILL_VOUCHER_TYPE_KEY = 'sales.bill_voucher_type';
/** The print design a bill uses when its type names none with a layout (§5.4). */
export const DEFAULT_BILL_PRINT_PURPOSE = 'SALE_INVOICE';

export const BILL_VOUCHER_TYPE_ERRORS = {
  REQUIRED: 'VT_BILL_TYPE_REQUIRED',
  INVALID: 'VT_BILL_TYPE_INVALID',
  LOCKED: 'VT_BILL_TYPE_LOCKED',
  /**
   * Decision 41's code (the master's writes), here with `field: 'sbVchrTypeId'`,
   * which picks its bill wording (variant field=sbVchrTypeId): an offline site
   * bills Sales Bill only (decision 64). 403, as in the master.
   */
  OFFLINE: 'VT_OFFLINE',
} as const;

/** Where the bill is being saved: an offline site (isOfflineSite) bills type 3 only. */
export interface BillTypeSite {
  offlineSite?: boolean;
}

type RawClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** What the bill reads of its settings (SalesContextService.values). */
export type BillSettingValues = (
  companyId: string,
  branchId: string,
  deviceId: string | null | undefined,
  keys: readonly string[],
) => Promise<Record<string, string | null>>;

export interface OfferedBillType {
  vchrTypeId: number;
  vchrTypeCode: string;
  vchrTypeName: string;
  vchrTypeShort: string | null;
  vchrParentId: number | null;
  vchrNoPrefix: string | null;
  vchrSortOrder: number;
}

const pickBool = (v: string | null | undefined): boolean => {
  const t = (v ?? '').trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes';
};

const pickInt = (v: string | null | undefined): number | null => {
  const n = Number.parseInt((v ?? '').trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * §7.4 posting: the type a bill's accounts voucher, GST register row and
 * bill-balance row carry — the bill's own (3, or its child type). A row read
 * before sb_vchr_type_id existed reads as 3.
 */
export function billVoucherTypeOf(bill: { sbVchrTypeId?: number | null }): number {
  return bill.sbVchrTypeId ?? BILL_BASE_VCHR_TYPE_ID;
}

/**
 * The counter a new bill draws its number from (review N11): the device's own
 * series only for Sales Bill (3) itself, in POS mode, with
 * sales.pos_series_per_device on and a device named; anything else — WHOLESALE,
 * every child type (decision 34), no device — the branch counter (null = 'MAIN').
 *
 * `posSeriesPerDevice` is the setting as the SAVE reads it: at company / branch
 * scope, `SalesContextService.settings(companyId, branchId)` with no device
 * (its max scope is COMPANY). createBillInTx and /bills/voucher-type-choices
 * both call this, so the previewed next number is the number the save draws.
 */
export function billSeriesDeviceCode(p: {
  vchrTypeId: number;
  billMode: string | null | undefined;
  posSeriesPerDevice: boolean;
  deviceId: string | null | undefined;
}): string | null {
  const deviceId = p.deviceId?.trim() || null;
  return p.vchrTypeId === BILL_BASE_VCHR_TYPE_ID &&
    (p.billMode ?? 'WHOLESALE') === 'POS' &&
    p.posSeriesPerDevice &&
    deviceId
    ? deviceId
    : null;
}

/** How many active child types of 3 the company has. 0 = it bills as before. */
export async function activeBillChildCount(client: RawClient, companyId: string): Promise<number> {
  const [row] = await client.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.acc_voucher_types
     WHERE vchr_parent_id = ${BILL_BASE_VCHR_TYPE_ID}::int
       AND vchr_company_id = ${companyId}::uuid
       AND vchr_is_active = true`;
  return typeof row?.n === 'number' ? row.n : 0;
}

/**
 * §5.3 — what a new bill of the company may be: its active children of 3, plus 3
 * itself when it has none or `sales.offer_base_bill_type` is on. Sort order, then id.
 * An offline site: 3 alone (decision 64).
 */
export async function offeredBillTypes(
  client: RawClient,
  companyId: string,
  offerBase: boolean,
  offlineSite = false,
): Promise<OfferedBillType[]> {
  const rows = await client.$queryRaw<
    {
      vchr_type_id: number;
      vchr_type_code: string;
      vchr_type_name: string;
      vchr_type_short: string | null;
      vchr_parent_id: number | null;
      vchr_no_prefix: string | null;
      vchr_sort_order: number;
    }[]
  >`
    SELECT vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short, vchr_parent_id,
           vchr_no_prefix, vchr_sort_order
      FROM accounts.acc_voucher_types
     WHERE (vchr_parent_id = ${BILL_BASE_VCHR_TYPE_ID}::int AND vchr_company_id = ${companyId}::uuid
            AND vchr_is_active = true)
        OR vchr_type_id = ${BILL_BASE_VCHR_TYPE_ID}::int
     ORDER BY vchr_sort_order, vchr_type_id`;
  const all = rows.map((r) => ({
    vchrTypeId: r.vchr_type_id,
    vchrTypeCode: r.vchr_type_code,
    vchrTypeName: r.vchr_type_name,
    vchrTypeShort: r.vchr_type_short,
    vchrParentId: r.vchr_parent_id,
    vchrNoPrefix: r.vchr_no_prefix,
    vchrSortOrder: r.vchr_sort_order,
  }));
  if (offlineSite) {
    return all.filter((t) => t.vchrTypeId === BILL_BASE_VCHR_TYPE_ID);
  }
  const children = all.filter((t) => t.vchrParentId === BILL_BASE_VCHR_TYPE_ID);
  return children.length === 0 || offerBase ? all : children;
}

/**
 * The offered types and the counter's default for a company / branch / device.
 * `defaultVchrTypeId` is the device's sales.bill_voucher_type when it is offered,
 * else null (the screen then takes the user's last pick, else the first choice).
 */
export async function billTypeChoices(
  client: RawClient,
  values: BillSettingValues,
  scope: { companyId: string; branchId: string; deviceId?: string | null } & BillTypeSite,
): Promise<{ offered: OfferedBillType[]; defaultVchrTypeId: number | null; offerBase: boolean }> {
  const settings = await values(scope.companyId, scope.branchId, scope.deviceId ?? null, [
    OFFER_BASE_BILL_TYPE_KEY,
    BILL_VOUCHER_TYPE_KEY,
  ]);
  const offerBase = pickBool(settings[OFFER_BASE_BILL_TYPE_KEY]);
  const offered = await offeredBillTypes(
    client,
    scope.companyId,
    offerBase,
    scope.offlineSite === true,
  );
  const deviceDefault = pickInt(settings[BILL_VOUCHER_TYPE_KEY]);
  return {
    offered,
    defaultVchrTypeId:
      deviceDefault !== null && offered.some((t) => t.vchrTypeId === deviceDefault)
        ? deviceDefault
        : null,
    offerBase,
  };
}

/** One voucher-type refusal of a bill, as a save throws it and /bills/validate lists it. */
export interface BillTypeRefusal {
  field: 'sbVchrTypeId';
  code: (typeof BILL_VOUCHER_TYPE_ERRORS)[keyof typeof BILL_VOUCHER_TYPE_ERRORS];
  message: string;
}

export type BillTypeVerdict =
  | { vchrTypeId: number; refusal: null }
  | { vchrTypeId: null; refusal: BillTypeRefusal };

const refusalOf = (code: BillTypeRefusal['code'], message: string): BillTypeVerdict => ({
  vchrTypeId: null,
  refusal: { field: 'sbVchrTypeId', code, message },
});

/**
 * §7.4 first save — the bill's type: the one sent (it must be offered), else the
 * device's default, else the only one offered. A company with no active child is
 * type 3 without reading a setting. VT_BILL_TYPE_REQUIRED when the company offers
 * several and nothing picks one (plan deviation, see the hand-over: the server does
 * not guess between Retail and Wholesale).
 *
 * An offline site (decision 64): type 3 whatever the company has, no setting read;
 * any other type sent is refused VT_OFFLINE.
 *
 * The ONE definition: the save throws its refusal (resolveBillVoucherType),
 * /bills/validate lists it (billTypeRefusals).
 */
export async function judgeBillVoucherType(
  client: RawClient,
  values: BillSettingValues,
  dto: {
    sbCompanyId: string;
    sbBranchId: string;
    sbDeviceId?: string | null;
    sbVchrTypeId?: number | null;
  },
  site: BillTypeSite = {},
): Promise<BillTypeVerdict> {
  const requested = dto.sbVchrTypeId ?? null;
  if (site.offlineSite) {
    if (requested === null || requested === BILL_BASE_VCHR_TYPE_ID) {
      return { vchrTypeId: BILL_BASE_VCHR_TYPE_ID, refusal: null };
    }
    return refusalOf(
      BILL_VOUCHER_TYPE_ERRORS.OFFLINE,
      `This install is an offline site (CLOUD_SYNC_ENABLED): it bills as Sales Bill (${BILL_BASE_VCHR_TYPE_ID}) only; voucher type ${requested} is billed on the main server.`,
    );
  }
  if ((await activeBillChildCount(client, dto.sbCompanyId)) === 0) {
    if (requested === null || requested === BILL_BASE_VCHR_TYPE_ID) {
      return { vchrTypeId: BILL_BASE_VCHR_TYPE_ID, refusal: null };
    }
    return refusalOf(
      BILL_VOUCHER_TYPE_ERRORS.INVALID,
      `Voucher type ${requested} is not an active bill type of company ${dto.sbCompanyId}; it bills as Sales Bill.`,
    );
  }
  const { offered, defaultVchrTypeId } = await billTypeChoices(client, values, {
    companyId: dto.sbCompanyId,
    branchId: dto.sbBranchId,
    deviceId: dto.sbDeviceId,
  });
  if (requested !== null) {
    if (!offered.some((t) => t.vchrTypeId === requested)) {
      return refusalOf(
        BILL_VOUCHER_TYPE_ERRORS.INVALID,
        `Voucher type ${requested} is not offered for bills of company ${dto.sbCompanyId} (offered: ${offered
          .map((t) => t.vchrTypeId)
          .join(', ')}).`,
      );
    }
    return { vchrTypeId: requested, refusal: null };
  }
  if (defaultVchrTypeId !== null) {
    return { vchrTypeId: defaultVchrTypeId, refusal: null };
  }
  if (offered.length === 1) {
    return { vchrTypeId: offered[0].vchrTypeId, refusal: null };
  }
  return refusalOf(
    BILL_VOUCHER_TYPE_ERRORS.REQUIRED,
    `Company ${dto.sbCompanyId} bills under ${offered.length} voucher types; pick one (sbVchrTypeId).`,
  );
}

/**
 * The first save: the type judgeBillVoucherType picks, or its refusal — a 422,
 * except VT_OFFLINE, a 403 as in the master.
 */
export async function resolveBillVoucherType(
  client: RawClient,
  values: BillSettingValues,
  dto: Parameters<typeof judgeBillVoucherType>[2],
  site: BillTypeSite = {},
): Promise<number> {
  const verdict = await judgeBillVoucherType(client, values, dto, site);
  if (verdict.refusal) {
    if (verdict.refusal.code === BILL_VOUCHER_TYPE_ERRORS.OFFLINE) {
      throwForbidden<BillErrorDetail>(verdict.refusal.message, [verdict.refusal]);
    }
    throwUnprocessable<BillErrorDetail>(verdict.refusal.message, [verdict.refusal]);
  }
  return verdict.vchrTypeId;
}

/**
 * Decision 64 on a SAVED bill: an offline site does not save again (update,
 * amend) or post a bill numbered under a child type. Null when the site is online
 * or the bill is Sales Bill (3) itself (a row with no type reads as 3).
 */
export function billOfflineTypeRefusal(
  existing: { sbVchrTypeId?: number | null; sbBillRefno?: string | null },
  site: BillTypeSite,
): BillTypeRefusal | null {
  const stored = existing.sbVchrTypeId ?? BILL_BASE_VCHR_TYPE_ID;
  if (!site.offlineSite || stored === BILL_BASE_VCHR_TYPE_ID) {
    return null;
  }
  return {
    field: 'sbVchrTypeId',
    code: BILL_VOUCHER_TYPE_ERRORS.OFFLINE,
    message: `Bill ${existing.sbBillRefno ?? ''} is numbered under voucher type ${stored}; this install is an offline site (CLOUD_SYNC_ENABLED), which saves and posts Sales Bill (${BILL_BASE_VCHR_TYPE_ID}) only. Do it on the main server.`,
  };
}

/** The save's / post's form of billOfflineTypeRefusal: 403 VT_OFFLINE. */
export function assertBillTypeAtSite(
  existing: { sbVchrTypeId?: number | null; sbBillRefno?: string | null },
  site: BillTypeSite,
): void {
  const refusal = billOfflineTypeRefusal(existing, site);
  if (refusal) {
    throwForbidden<BillErrorDetail>(refusal.message, [refusal]);
  }
}

/** Q5 — a saved bill keeps its type. Sending the same type, or none, is fine. */
export function billTypeLockRefusal(
  existing: { sbVchrTypeId?: number | null; sbBillRefno?: string | null },
  requested: number | null | undefined,
): BillTypeRefusal | null {
  if (requested === undefined || requested === null) {
    return null;
  }
  const stored = existing.sbVchrTypeId ?? BILL_BASE_VCHR_TYPE_ID;
  if (requested === stored) {
    return null;
  }
  return {
    field: 'sbVchrTypeId',
    code: BILL_VOUCHER_TYPE_ERRORS.LOCKED,
    message: `Bill ${existing.sbBillRefno ?? ''} is numbered under voucher type ${stored}; its type cannot change to ${requested}. Cancel it and bill again.`,
  };
}

/** The save's form of billTypeLockRefusal: 409 VT_BILL_TYPE_LOCKED. */
export function assertBillTypeUnchanged(
  existing: { sbVchrTypeId?: number | null; sbBillRefno?: string | null },
  requested: number | null | undefined,
): void {
  const refusal = billTypeLockRefusal(existing, requested);
  if (refusal) {
    throwConflict<BillErrorDetail>(refusal.message, [refusal]);
  }
}

/**
 * /bills/validate — the voucher-type refusals the save would answer, listed
 * instead of thrown: for a body with no sbId (a first save) the resolution and
 * its checks (VT_BILL_TYPE_REQUIRED / _INVALID, VT_OFFLINE at an offline site);
 * for a saved bill VT_OFFLINE (a child-type bill at an offline site), else the
 * lock (VT_BILL_TYPE_LOCKED). A saved bill that is not found is left to the save.
 */
export async function billTypeRefusals(
  client: RawClient,
  values: BillSettingValues,
  dto: Parameters<typeof judgeBillVoucherType>[2] & {
    sbId?: string | null;
    sbAccYear?: string | null;
  },
  site: BillTypeSite = {},
): Promise<BillTypeRefusal[]> {
  if (dto.sbId) {
    const [saved] = await client.$queryRaw<
      { sb_vchr_type_id: number; sb_bill_refno: string | null }[]
    >`
      SELECT sb_vchr_type_id, sb_bill_refno FROM sales.sale_bill
       WHERE sb_id = ${dto.sbId}::uuid
         AND (${dto.sbAccYear ?? null}::text IS NULL OR sb_acc_year = ${dto.sbAccYear ?? null}::char(9))
         AND sb_is_deleted = false
       LIMIT 1`;
    if (!saved || typeof saved.sb_vchr_type_id !== 'number') {
      return [];
    }
    const existing = { sbVchrTypeId: saved.sb_vchr_type_id, sbBillRefno: saved.sb_bill_refno };
    // The save's order (BillService.applySaveInTx): the site first, then the lock.
    const refusal =
      billOfflineTypeRefusal(existing, site) ?? billTypeLockRefusal(existing, dto.sbVchrTypeId);
    return refusal ? [refusal] : [];
  }
  const verdict = await judgeBillVoucherType(client, values, dto, site);
  return verdict.refusal ? [verdict.refusal] : [];
}

/** /bills/get `voucherType` (§7.4 / §5.4). */
export interface BillVoucherTypeBlock {
  vchrTypeId: number;
  vchrTypeName: string | null;
  vchrTypeShort: string | null;
  vchrParentId: number | null;
  printTitle: string | null;
  printPurposeCode: string;
  printAfterPost: boolean;
}

/**
 * What billVoucherTypeBlock reads of one design (the type's own, or its base's):
 * the three parts of the usable rule (S2, decision 62), each on its own so a
 * refusal is visible. All three must hold.
 */
export interface DesignFacts {
  code: string | null;
  name: string | null;
  /** (a) live and active. */
  live: boolean | null;
  /** (b) a live, active, published template, shared or the bill's company's. */
  layout: boolean | null;
  /** (c) the company / every-company PRINT assignment resolves to such a template. */
  assigned: boolean | null;
}

/** (a) AND (b) AND (c) — PRINT_DESIGN_USABLE_RULE, as the server reads it. */
export function designUsable(d: DesignFacts): boolean {
  return !!d.code && d.live === true && d.layout === true && d.assigned === true;
}

/**
 * Print design (§5.4, OP-4; review S2 / decision 62): the type's own when it is
 * usable for the bill's company — live, with a published layout, AND an active
 * PRINT assignment that resolves for that company — else its base's on the same
 * rule, else SALE_INVOICE (not itself checked, as before). A child whose design
 * has a layout but nothing assigned yet prints with the base's. Title: the
 * type's, else the base's, else the chosen design's name.
 */
export async function billVoucherTypeBlock(
  client: RawClient,
  bill: { sbVchrTypeId?: number | null; sbCompanyId: string },
): Promise<BillVoucherTypeBlock> {
  const typeId = bill.sbVchrTypeId ?? BILL_BASE_VCHR_TYPE_ID;
  const company = Prisma.sql`${bill.sbCompanyId}::uuid`;
  const rule = (text: string, alias: 'op' | 'bp') => printDesignRuleSql(text, alias, company);
  const [r] = await client.$queryRaw<
    {
      vchr_type_id: number;
      vchr_type_name: string;
      vchr_type_short: string | null;
      vchr_parent_id: number | null;
      own_title: string | null;
      base_title: string | null;
      print_after_post: boolean;
      own_code: string | null;
      own_name: string | null;
      own_live: boolean | null;
      own_layout: boolean | null;
      own_assigned: boolean | null;
      base_code: string | null;
      base_name: string | null;
      base_live: boolean | null;
      base_layout: boolean | null;
      base_assigned: boolean | null;
      default_name: string | null;
    }[]
  >`
    SELECT t.vchr_type_id, t.vchr_type_name, t.vchr_type_short, t.vchr_parent_id,
           t.vchr_print_title AS own_title, b.vchr_print_title AS base_title,
           t.vchr_print_after_post AS print_after_post,
           op.ppo_code AS own_code, op.ppo_name AS own_name,
           (${rule(PRINT_DESIGN_LIVE_RULE, 'op')}) AS own_live,
           ${rule(PRINT_DESIGN_LAYOUT_RULE, 'op')} AS own_layout,
           ${rule(PRINT_DESIGN_ASSIGNMENT_RULE, 'op')} AS own_assigned,
           bp.ppo_code AS base_code, bp.ppo_name AS base_name,
           (${rule(PRINT_DESIGN_LIVE_RULE, 'bp')}) AS base_live,
           ${rule(PRINT_DESIGN_LAYOUT_RULE, 'bp')} AS base_layout,
           ${rule(PRINT_DESIGN_ASSIGNMENT_RULE, 'bp')} AS base_assigned,
           (SELECT d.ppo_name FROM public.print_purpose d
             WHERE d.ppo_company_id IS NULL AND d.ppo_code = ${DEFAULT_BILL_PRINT_PURPOSE}
               AND d.ppo_is_deleted = false LIMIT 1) AS default_name
      FROM accounts.acc_voucher_types t
      LEFT JOIN accounts.acc_voucher_types b ON b.vchr_type_id = t.vchr_parent_id
      LEFT JOIN public.print_purpose op ON op.ppo_id = t.vchr_print_purpose_id
      LEFT JOIN public.print_purpose bp ON bp.ppo_id = b.vchr_print_purpose_id
     WHERE t.vchr_type_id = ${typeId}::int`;
  if (!r) {
    return {
      vchrTypeId: typeId,
      vchrTypeName: null,
      vchrTypeShort: null,
      vchrParentId: null,
      printTitle: null,
      printPurposeCode: DEFAULT_BILL_PRINT_PURPOSE,
      printAfterPost: false,
    };
  }
  const own: DesignFacts = {
    code: r.own_code,
    name: r.own_name,
    live: r.own_live,
    layout: r.own_layout,
    assigned: r.own_assigned,
  };
  const base: DesignFacts = {
    code: r.base_code,
    name: r.base_name,
    live: r.base_live,
    layout: r.base_layout,
    assigned: r.base_assigned,
  };
  const design = designUsable(own)
    ? { code: own.code!, name: own.name }
    : designUsable(base)
      ? { code: base.code!, name: base.name }
      : { code: DEFAULT_BILL_PRINT_PURPOSE, name: r.default_name };
  return {
    vchrTypeId: r.vchr_type_id,
    vchrTypeName: r.vchr_type_name,
    vchrTypeShort: r.vchr_type_short,
    vchrParentId: r.vchr_parent_id,
    printTitle: r.own_title?.trim() || r.base_title?.trim() || design.name || null,
    printPurposeCode: design.code,
    printAfterPost: r.print_after_post === true,
  };
}
