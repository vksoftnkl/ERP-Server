import type {
  StockBucket,
  StockVoucherCancelResult,
  StockVoucherPayload,
  StockVoucherStatus,
} from '../../stock-voucher/types/stock-voucher.types';

/**
 * The link a TRANSFER_IN must carry back to its despatch.
 *
 * `ck_svh_transfer_in_link` enforces the id, and `fn_svh_receive_transfer`
 * checks the module and doc type by hand and refuses anything else. They are
 * constants rather than payload fields for that reason: a receipt that names
 * some other module's document is not a receipt, and there is nothing for the
 * client to choose here.
 */
export const TRANSFER_LINK_SRC_MODULE = 'STOCK';
export const TRANSFER_LINK_SRC_DOC_TYPE = 'STOCK_VOUCHER';

/**
 * One `stock_transit` row as the screens read it.
 *
 * `remainingQty` is `sent − received − damage`, which is also what the
 * GENERATED `stt_short_qty` holds — the same figure under two names because it
 * means two different things depending on when you ask. While the transfer is
 * open it is what is still owed; once it closes it is what was lost.
 */
export interface StockTransitRow {
  sttId: string;
  status: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  lotId: string;
  batchNo: string | null;
  expiryDate: string | null;
  toGodownId: string;
  toGodownName: string | null;
  bucket: StockBucket;
  baseUomId: string;
  unitName: string | null;
  sentQty: number;
  receivedQty: number;
  damageQty: number;
  /** sent − received − damage. What a second receipt must open with. */
  remainingQty: number;
  costRate: number;
  transitValue: number;
  lrNo: string | null;
  vehicleNo: string | null;
  expectedOn: string | null;
  sentOn: string | null;
  receivedOn: string | null;
}

/**
 * §4.3 — what the despatch answers with.
 *
 * `sameBranch` is the whole point of the shape: forms 3 and 4 are one endpoint,
 * the engine decides which happened by looking at `svh_to_branch_id`, and the
 * screen cannot know how to finish until it is told. `status` is read back off
 * the row, never assumed from the request.
 */
export interface StockTransferDespatchResult extends StockVoucherPayload {
  /** true = godown → godown, POSTED, no transit row. false = a lorry left. */
  sameBranch: boolean;
  status: StockVoucherStatus;
  /** What fn_svh_post_transfer returned: 2 per line same-branch, 1 per line out. */
  ledgerRows: number;
  transitRows: number;
  transit: StockTransitRow[];
}

/** §6 — one line of the receipt screen, opened at the REMAINDER. */
export interface StockTransferPrefillRow extends StockTransitRow {
  /** The line number the receipt grid should give this row. */
  lineNo: number;
}

export interface StockTransferPrefill {
  outVoucher: {
    svhId: string;
    accYear: string;
    refno: string;
    docDate: string;
    status: StockVoucherStatus;
    fromBranchId: string;
    fromGodownId: string | null;
    toBranchId: string | null;
    toGodownId: string | null;
  };
  rows: StockTransferPrefillRow[];
}

/**
 * §8.2 — BOTH documents, because the receipt closing does not mean the transfer
 * closed. The OUT flips to RECEIVED only when no transit row of it has anything
 * left; a short keeps it open on purpose, and that is the loss report.
 */
export interface StockTransferReceiveResult {
  inVoucher: StockVoucherPayload & { ledgerRows: number; status: StockVoucherStatus };
  outVoucher: {
    svhId: string;
    accYear: string;
    refno: string;
    status: StockVoucherStatus;
    /** true when every transit row of the OUT is settled. */
    closed: boolean;
  };
  transit: StockTransitRow[];
}

/** §9.2 — a same-branch cancel, with the shape it reversed named explicitly. */
export interface StockTransferCancelResult extends StockVoucherCancelResult {
  sameBranch: boolean;
}
