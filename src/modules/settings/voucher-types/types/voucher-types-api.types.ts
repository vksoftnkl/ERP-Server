import type { AccVoucherType, VoucherNumberingMode } from '@prisma/client';
import type {
  MirrorField,
  NumberedBy,
  NumberingPreview,
  VoucherKind,
  VtIssue,
} from '../voucher-types.rules';

/** GET /voucher-types/tree → data.nodes[] (flat; the screen builds the tree by vchrParentId). */
export interface VoucherTypeNode {
  vchrTypeId: number;
  vchrTypeCode: string;
  vchrTypeName: string;
  vchrTypeShort: string | null;
  vchrParentId: number | null;
  vchrCompanyId: string | null;
  vchrNature: string;
  kind: VoucherKind;
  numberedBy: NumberedBy;
  vchrIsActive: boolean;
  vchrSortOrder: number;
  childCount: number;
  canHaveChildren: boolean;
  /** The prefix / suffix as written (tokens raw), for the tree search — added 11-15 round 2. */
  vchrNoPrefix: string | null;
  vchrNoSuffix: string | null;
}

/** /get `branches[]` — added 11-15 round 2. */
export interface VoucherTypeBranchState {
  branchId: string;
  branchName: string;
  /** The Bill Prefix, else the code, upper-cased (what {BR} prints); null when both are blank. */
  branchCode: string | null;
  isDefault: boolean;
  /** A live counter of this type at the branch in the year asked (any device). */
  hasCounter: boolean;
  /** The number on the branch's latest voucher of this type in the year (not DRAFT, not deleted). */
  lastVoucherRefno: string | null;
}

export interface VoucherTypeCounter {
  branchId: string;
  branchName: string;
  branchCode: string | null;
  deviceCode: string;
  lastNo: string;
  lastRefno: string | null;
}

export interface VoucherTypePrintDesign {
  ppoId: string;
  ppoCode: string;
  ppoName: string;
  ppoCopyCount: number;
  ppoCopyLabels: string | null;
  /** company NULL: shared by every company (a base may name only these). */
  isShared: boolean;
  /** A live, active print template with a published revision (OP-4: "no layout yet" when false). */
  hasLayout: boolean;
  /**
   * Review S2 / decision 62 (added 11-15 review round): the company's (or the
   * every-company) active PRINT assignment — no branch, no counter — names a
   * live, published template, i.e. a bill of this company would print with it.
   * hasLayout && !hasAssignment = "no assignment yet". A bill uses the design
   * only when both are true; else OP-4 falls back to the base's, then SALE_INVOICE.
   */
  hasAssignment: boolean;
}

/** GET /voucher-types/get → data; /save answers the same plus warnings[]. */
export interface VoucherTypePayload {
  type: AccVoucherType;
  /** The base's accounting columns (a base: its own) — what a child mirrors (decision 31). */
  inherited: Pick<AccVoucherType, MirrorField | 'vchrTypeId' | 'vchrTypeCode' | 'vchrTypeName'>;
  kind: VoucherKind;
  numberedBy: NumberedBy;
  isBase: boolean;
  isGstOutward: boolean;
  canHaveChildren: boolean;
  /** Decision 42: the Method values the screen may offer. ['AUTO'] today. */
  allowedMethods: VoucherNumberingMode[];
  /** Base 3 only: sales.offer_base_bill_type for this company; null elsewhere. */
  offerBase: boolean | null;
  /** Bills of this company on this type. */
  billCount: number;
  /** Any bill, counter or voucher (any company) uses the type: delete is refused (VT_IN_USE). */
  inUse: boolean;
  /** This year's counters of the type in this company (a base: this company's). */
  counters: VoucherTypeCounter[];
  /**
   * Added 11-15 round 2. Accounts vouchers of the type (acc_voucher_header) in this
   * company and year, every branch, POSTED + CANCELLED (not DRAFT, not deleted).
   * For every type — billCount stays the Sales Bill's own count of sale_bill rows.
   */
  voucherCount: number;
  /** The number on the latest such voucher at the preview branch; null when none. */
  lastVoucherRefno: string | null;
  /** Its voucher date, 'YYYY-MM-DD'. */
  lastVoucherDate: string | null;
  /** The company's active branches for the year asked. */
  branches: VoucherTypeBranchState[];
  /** ppo_doc_type the designs are of; null when the type's print design is not wired. */
  printDocType: string | null;
  printDesigns: VoucherTypePrintDesign[];
  preview: NumberingPreview;
  /**
   * Delivery tracking (Q3). true for Sales Bill and its children: the screen
   * shows its Delivery section only then. `type.vchrDeliveryMode` is the row's
   * own value (a child never saved with one: null = the base's).
   */
  deliveryModeApplies: boolean;
  /** The base's mode (a base: its own); null when the type has none. */
  inheritedDeliveryMode: string | null;
  /** What a new bill of the type defaults to: own → base → INSTANT; null when none applies. */
  effectiveDeliveryMode: string | null;
}

/** POST /voucher-types/validate → data. */
export interface VoucherTypeValidation {
  ok: boolean;
  errors: VtIssue[];
  warnings: VtIssue[];
  preview: NumberingPreview;
  /** The mode the save would store (null = the base's on a child). */
  vchrDeliveryMode: string | null;
  deliveryModeApplies: boolean;
  inheritedDeliveryMode: string | null;
  effectiveDeliveryMode: string | null;
}
