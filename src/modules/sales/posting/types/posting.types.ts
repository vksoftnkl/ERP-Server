/**
 * The blocks the posting services BUILD, and the codes they raise.
 *
 * `HANDOVER_endpoints.md` §1 is explicit that `posting`, `locks` and
 * `warnings[]` are assembled HERE and not by the controllers: a controller that
 * built its own would give the bill screen one shape and the challan screen
 * another, and the Qt client switches on `code` alone.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Error codes — HANDOVER §9. `code` is what the client switches on, so these
//  strings are an API contract: rename one and a screen stops reacting.
// ═══════════════════════════════════════════════════════════════════════════

export const SALES_ERROR_CODES = {
  // Lifecycle
  BILL_POSTED: 'SALES_BILL_POSTED',
  BILL_CANCELLED: 'SALES_BILL_CANCELLED',
  REVISION_STALE: 'SALES_REVISION_STALE',
  AMEND_OFF: 'SALES_AMEND_OFF',

  // Rights — the user_menus flags. The six screen verbs (VIEW … EXPORT) joined
  // the posting verbs for the Voucher Register, whose every call is judged on
  // the voucher TYPE's menu (acc_voucher_types.vchr_menu_id).
  RIGHT_VIEW: 'SALES_RIGHT_VIEW',
  RIGHT_CREATE: 'SALES_RIGHT_CREATE',
  RIGHT_EDIT: 'SALES_RIGHT_EDIT',
  RIGHT_DELETE: 'SALES_RIGHT_DELETE',
  RIGHT_PRINT: 'SALES_RIGHT_PRINT',
  RIGHT_EXPORT: 'SALES_RIGHT_EXPORT',
  RIGHT_POST: 'SALES_RIGHT_POST',
  RIGHT_CANCEL: 'SALES_RIGHT_CANCEL',
  RIGHT_AMEND: 'SALES_RIGHT_AMEND',
  RIGHT_OVERRIDE: 'SALES_RIGHT_OVERRIDE',
  RIGHT_RETENDER: 'SALES_RETENDER_RIGHT',

  // The two derived lock points (§1.3a)
  RETURN_LOCKS_BILL: 'SALES_RETURN_LOCKS_BILL',
  ALLOCATION_LOCKS_BILL: 'SALES_ALLOCATION_LOCKS_BILL',
  IRN_LIVE: 'SALES_IRN_LIVE',
  EWB_LIVE: 'SALES_EWB_LIVE',
  DECLARED_LOCKED: 'GST_DECLARED_LOCKED',
  IRN_WINDOW_PASSED: 'SALES_IRN_WINDOW_PASSED',
  EWB_WINDOW_PASSED: 'SALES_EWB_WINDOW_PASSED',
  IRN_CANCEL_FAILED: 'GST_IRN_CANCEL_FAILED',
  EWB_EXPIRED: 'GST_EWB_EXPIRED',
  CREDIT_NOTE_CUTOFF: 'GST_CREDIT_NOTE_CUTOFF',

  // Orders
  ORDER_DELIVERED: 'SALES_ORDER_DELIVERED',
  ORDER_LINE_DELIVERED: 'SALES_ORDER_LINE_DELIVERED',
  ORDER_CONFIRMED: 'SALES_ORDER_CONFIRMED',
  /** A bill names an order that is not CONFIRMED / PARTIAL — not yet, or no longer, billable. */
  ORDER_NOT_OPEN: 'SALES_ORDER_NOT_OPEN',
  RESERVE_SHORT: 'SALES_RESERVE_SHORT',

  // Challans and DC returns
  DC_PURPOSE_NOT_ALLOWED: 'SALES_DC_PURPOSE_NOT_ALLOWED',
  DC_REQUIRES_ORDER: 'SALES_DC_REQUIRES_ORDER',
  DC_LINE_OVER_ORDER: 'SALES_DC_LINE_OVER_ORDER',
  DC_BILLED: 'SALES_DC_BILLED',
  DC_RETURNED: 'SALES_DC_RETURNED',
  DCR_OVER_OPEN: 'SALES_DCR_OVER_OPEN',
  DCR_DC_NOT_POSTED: 'SALES_DCR_DC_NOT_POSTED',

  // Sale returns
  RETURN_OVER_QTY: 'SALES_RETURN_OVER_QTY',
  RETURN_BILL_NOT_POSTED: 'SALES_RETURN_BILL_NOT_POSTED',
  RETURN_ITEM_NOT_ALLOWED: 'SALES_RETURN_ITEM_NOT_ALLOWED',
  FREE_RETURN_OFF: 'SALES_FREE_RETURN_OFF',
  RETURN_WINDOW: 'SALES_RETURN_WINDOW',
  CN_APPLIED: 'SALES_CN_APPLIED',

  // Documents in general
  DOC_POSTED: 'SALES_DOC_POSTED',
  DOC_CANCELLED: 'SALES_DOC_CANCELLED',
  DOC_NOT_DRAFT: 'SALES_DOC_NOT_DRAFT',
  NOT_FOUND: 'SALES_NOT_FOUND',

  // Calendar
  DAY_CLOSED: 'SALES_DAY_CLOSED',
  YEAR_LOCKED: 'SALES_YEAR_LOCKED',
  BACKDATE: 'SALES_BACKDATE',

  // The law (§3.6 resolves the figure; the guard raises the code)
  CASH_LIMIT: 'SALES_CASH_LIMIT',
  PAN_REQUIRED: 'SALES_PAN_REQUIRED',
  /** A bill with no customer at all: its voucher and receivable have nobody to be raised against. */
  CUSTOMER_REQUIRED: 'SALES_CUSTOMER_REQUIRED',
  HSN_DIGITS: 'HSN_DIGITS',

  // Commercial
  CREDIT_LIMIT: 'SALES_CREDIT_LIMIT',
  RATE_BELOW_MIN: 'SALES_RATE_BELOW_MIN',
  DISC_CAP: 'SALES_DISC_CAP',
  TENDER_DAILY_LIMIT: 'SALES_TENDER_DAILY_LIMIT',
  TENDER_MIN_MAX: 'SALES_TENDER_MIN_MAX',
  LOYALTY_CAP: 'SALES_LOYALTY_CAP',
  PROMO_NOT_LIVE: 'SALES_PROMO_NOT_LIVE',
  DC_LINE_OVER: 'SALES_DC_LINE_OVER',
  /**
   * NOT in HANDOVER §9's table — added here because flow §7 describes the
   * refusal ("over-carry is refused unless `um_can_override`") without naming
   * a code for it, and the client needs one to switch on. Tell the Qt side.
   */
  CHARGE_OVER_CARRY: 'SALES_CHARGE_OVER_CARRY',
  ORDER_LINE_OVER: 'SALES_ORDER_LINE_OVER',
  STOCK_NEGATIVE: 'SALES_STOCK_NEGATIVE',
  EWAY_TRANSPORT_MISSING: 'SALES_EWAY_TRANSPORT_MISSING',
  DELIVERY_ORDER: 'SALES_DELIVERY_ORDER',

  // Temp credit (31)
  TEMP_CREDIT_DETAILS_MISSING: 'SALES_TEMP_CREDIT_DETAILS_MISSING',
  TEMP_CREDIT_DAYS: 'SALES_TEMP_CREDIT_DAYS',
  TEMP_CREDIT_AMOUNT: 'SALES_TEMP_CREDIT_AMOUNT',
  TEMP_CREDIT_OPEN: 'SALES_TEMP_CREDIT_OPEN',

  // Re-tender (35)
  RETENDER_AMOUNT_MISMATCH: 'SALES_RETENDER_AMOUNT_MISMATCH',
  RETENDER_PDC_MOVED: 'SALES_RETENDER_PDC_MOVED',
  /**
   * NOT in HANDOVER §9's table — notes (46). A bill's cheque tender is in the
   * cheque register, and once it is DEPOSITED / CLEARED / BOUNCED (or returned,
   * or replaced) the bill can no longer be cancelled or amended around it.
   * Tell the Qt side.
   */
  BILL_PDC_MOVED: 'SALES_BILL_PDC_MOVED',

  // Salesmen — the guard that replaces a foreign key (§3.7)
  SALESMAN_INVALID: 'SALES_SALESMAN_INVALID',

  /**
   * The assertion, not a rule. Σ stock rows ≠ Σ line qty means the posting
   * engine lost a line, so it is refused loudly rather than reconciled.
   */
  STOCK_QTY_MISMATCH: 'SALES_STOCK_QTY_MISMATCH',
  /**
   * NOT in HANDOVER §9's table — the bill's declared total does not agree with
   * its own parts (taxable + tax + charges + round-off + TCS − discounts). The
   * receivable is booked at the parts, so a disagreement is refused rather than
   * silently re-derived. Tell the Qt side.
   */
  AMOUNT_MISMATCH: 'SALES_AMOUNT_MISMATCH',
  /**
   * NOT in HANDOVER §9's table — the goods cannot move because no registered
   * device stands behind the document. A sales document's device id is free
   * text (a fingerprint or hostname), but the shadow stock voucher it posts
   * through carries `svh_device_id uuid NOT NULL` with a foreign key to
   * `fixed.device_master`. The document's own id is tried first, then the
   * counter the session logged in at; neither being a registered device is
   * refused here rather than surfacing as a 23503 the operator cannot read.
   */
  DEVICE_UNREGISTERED: 'SALES_DEVICE_UNREGISTERED',
} as const;

export type SalesErrorCode = (typeof SALES_ERROR_CODES)[keyof typeof SALES_ERROR_CODES];

/**
 * A known code, or any other string. `string & {}` keeps the known members
 * visible to autocomplete where a bare `string` would swallow them.
 */
export type SalesErrorCodeLike = SalesErrorCode | (string & {});

// ═══════════════════════════════════════════════════════════════════════════
//  §1.5 — warnings and refusals
// ═══════════════════════════════════════════════════════════════════════════

/** INFO is shown and never blocks; WARN may be overridden; REFUSE never may. */
export type SalesWarningLevel = 'INFO' | 'WARN' | 'REFUSE';

/** The statutory provenance a refusal carries when a figure came from an Act. */
export interface SalesStatutoryRef {
  code: string;
  value: number | string | null;
  effectiveFrom: string;
  isCompanyOverride: boolean;
}

export interface SalesWarning {
  code: SalesErrorCodeLike;
  level: SalesWarningLevel;
  message: string;
  field?: string;
  line?: number;
  /**
   * True only when BOTH could let it pass: the code is overridable in
   * principle, and the guard will then check `overrides[]` ∧ `rights.override`.
   * The client greys its override button from this.
   */
  overridable: boolean;
  statutory?: SalesStatutoryRef;
}

export interface SalesRefusal {
  code: SalesErrorCodeLike;
  message: string;
  field?: string;
  line?: number;
  statutory?: SalesStatutoryRef;
}

/**
 * What a guard run accumulates. `warnings` survive the post; `refusals` stop
 * it. The context is passed DOWN through the guards rather than returned, so a
 * validate run and a post run execute exactly the same code.
 */
export interface SalesGuardContext {
  warnings: SalesWarning[];
  refusals: SalesRefusal[];
  /** Codes the request asked to override. Meaningless without `canOverride`. */
  overrides: string[];
  /** `user_menus.um_can_override` for this user on this menu. */
  canOverride: boolean;
  /** false on `/validate` — collect everything instead of throwing on the first. */
  throwOnRefusal: boolean;
  /**
   * true on `/validate` only. An overridable WARN is then reported as a WARN
   * and NOT also as a refusal: whether it is overridden is decided at `/post`,
   * which runs the same guard with `dryRun` false and refuses it there unless
   * `overrides[]` names it and the user holds `um_can_override`. Reporting it
   * as a refusal here told the client the bill could never post.
   */
  dryRun: boolean;
}

export function createGuardContext(opts: Partial<SalesGuardContext> = {}): SalesGuardContext {
  return {
    warnings: [],
    refusals: [],
    overrides: [],
    canOverride: false,
    throwOnRefusal: true,
    dryRun: false,
    ...opts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  §1.2 `posting` and §1.3 `locks`
// ═══════════════════════════════════════════════════════════════════════════

export type GstDocStatus =
  | 'NA'
  | 'PENDING'
  | 'GENERATED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export interface PostingIrnBlock {
  status: GstDocStatus;
  number: string | null;
  ackNo: string | null;
  ackOn: string | null;
  message: string | null;
}

export interface PostingEwbBlock {
  status: GstDocStatus;
  number: string | null;
  generatedOn: string | null;
  validUpto: string | null;
  message: string | null;
  /**
   * §1.6a — the vehicle the e-way bill was raised against (`gdw_vehicle_no`).
   * Null until one exists, and null on a Part-A-only bill; the band shows the
   * number rather than only "declared".
   */
  vehicleNo: string | null;
}

export interface PostingBlock {
  voucherId: string | null;
  voucherRefno: string | null;
  postedOn: string | null;
  registerId: string | null;
  /** What THIS document posted as COGS — 0 under PERIODIC or bill-against-DC. */
  cogsAmt: number;
  loyaltyEarned: number;
  loyaltyRedeemed: number;
  irn: PostingIrnBlock;
  ewb: PostingEwbBlock;
}

/**
 * §1.3a — every field here is DERIVED at read time. Nothing in this shape is
 * stored, and a `ttd_is_locked` column is explicitly forbidden: a stored flag
 * drifts from the thing it describes.
 */
export interface LocksBlock {
  returns: number;
  allocations: number;
  dayClosed: boolean;
  irnLive: boolean;
  ewbLive: boolean;
  irnCancelWindowUntil: string | null;
  ewbValidUpto: string | null;
  editable: {
    /** Lock 1: false once the document is POSTED. */
    document: boolean;
    /** Lock 2: false once an IRN or an e-way bill is GENERATED. */
    transportBand: boolean;
    /** Challans only: false after lock 2, or once any line is billed / returned. */
    purpose?: boolean;
  };
}

/**
 * The five transaction rights on `public.user_menus`, exactly as `loadRights`
 * reads them — one shape, so a caller cannot be handed four of the five.
 *
 * `retender` is meaningful on Sales Entry alone (`menu_verbs` holds RETENDER on
 * menu 12 and nowhere else), and it is reported for every document anyway
 * rather than being optional: a missing key and `false` are the same answer to
 * "may this user re-tender here?", and only one of them is a shape the client
 * has to defend against. It used to be dropped on the way out, which is why
 * §1.7b's re-tender dialog could not tell a denied right from an absent one.
 */
export interface RightsBlock {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
  post: boolean;
  cancel: boolean;
  amend: boolean;
  override: boolean;
  retender: boolean;
}
