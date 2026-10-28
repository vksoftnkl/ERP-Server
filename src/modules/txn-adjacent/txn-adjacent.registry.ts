import {
  PAYMENT_MENU_ID,
  PAYMENT_VOUCHER_TYPE_CODE,
} from '../accountsModule/payment/types/payment-enum';
import {
  RECEIPT_MENU_ID,
  RECEIPT_VOUCHER_TYPE_CODE,
} from '../accountsModule/receipt/types/receipt-enum';
import { SALES_MENU_ID } from '../sales/posting/sales-doc.utils';
import { STOCK_ADJUSTMENT_KINDS } from '../stocks/stock-adjustment/stock-adjustment.rules';

/**
 * Notes 142 — every document `GET /txn/adjacent` walks, as a FIXED map from
 * `docType` to its header table and columns.
 *
 * Nothing in here ever comes from the request: the service splices these
 * strings into its SQL with `Prisma.raw`, so this file is the whole list of
 * identifiers that query can name. The registry spec checks each one is a
 * plain `alias.column` / `schema.table` and nothing else.
 *
 * All the headers share one shape (checked live 2026-10-23): id, company,
 * branch, the `acc_year` partition key, a date, a serial, a status, a deleted
 * flag and `created_on`. They differ only in names, in which rows of a SHARED
 * table belong to the screen (`stock_voucher` holds eleven voucher types,
 * `acc_voucher_header` every voucher), in the menu whose rights read them, and
 * in whether the serial can order a date's documents at all (notes 152).
 */
export const TXN_DOC_TYPES = [
  'OPENING_STOCK',
  'STOCK_ADJUSTMENT',
  'PHYSICAL_STOCK',
  'STOCK_TRANSFER',
  'STOCK_TRANSFER_RECEIPT',
  'SALE_BILL',
  'QUOTATION',
  'SALE_ORDER',
  'DELIVERY_CHALLAN',
  'DC_RETURN',
  'SALE_RETURN',
  'RECEIPT',
  'PAYMENT',
  'VOUCHER',
  'PURCHASE_ORDER',
  'GRN',
  'PURCHASE_BILL',
  'PURCHASE_RETURN',
  'SHORTAGE_RECEIPT',
] as const;

export type TxnDocType = (typeof TXN_DOC_TYPES)[number];

/**
 * The menu whose `user_menus.um_can_view` lets a caller see the rows: one
 * fixed menu for the whole docType, or `VOUCHER_TYPE` — each voucher's own
 * type menu (`acc_voucher_types.vchr_menu_id`), joined row by row exactly as
 * `/vouchers/adjacent` does, so a user with rights on Journal alone is never
 * stepped onto a Contra.
 */
export type TxnDocMenu = number | 'VOUCHER_TYPE';

export interface TxnDocSpec {
  /** Words for messages: "no previous opening stock voucher". */
  label: string;
  /** Schema-qualified header table, aliased `h` in every query. */
  table: string;
  /** A join the type column or the menu needs. Fixed SQL. */
  join?: string;
  // Header columns, bare: the service qualifies them (`h.` for the walked
  // rows, `c.` for the document on screen).
  id: string;
  company: string;
  branch: string;
  year: string;
  date: string;
  /**
   * The serial in the walk key, between the date and `created_on` — or null
   * (notes 152). A serial counted per DEVICE or per counter cannot order a
   * date's documents: two PCs on one branch each count 1, 2, 3 …, so their
   * documents interleave by each PC's own counter, and Ctrl+PgDn from the
   * user's newest entry lands on another PC's old one. Such a docType walks by
   * `(date, created_on, id)`, which is branch-wide and follows entry order —
   * the order the refno is counted in, since both are given at the first save.
   * Only a serial counted branch-wide (or company-wide) and drawn by the
   * screen's list goes in; checked per table in the registry below.
   */
  serial: TxnDocSerial | null;
  createdOn: string;
  status: string;
  deleted: string;
  refno: string;
  /** The type each row answers with and `typeCode` matches — qualified, since it may sit on the join. */
  type: string;
  /**
   * The only types this docType walks, when its table holds other screens'
   * documents too. Omitted: every row of the table is this docType's, and
   * `typeCode` may name any value of `type`.
   */
  types?: readonly string[];
  /** A further fixed condition every walked row meets. */
  where?: string;
  /** The values `status` may filter on: the table's CHECK. */
  statuses: readonly string[];
  menu: TxnDocMenu;
}

/** A serial that orders a date's documents: the column, and where a row without one sorts. */
export interface TxnDocSerial {
  /** Bare column name; the service qualifies it. */
  column: string;
  /**
   * Where a document with no serial yet (a draft voucher) sorts within its
   * date — copied from the screen's own list so the walk steps through the
   * rows in the order they are drawn. `LOW` = the old end (coalesced to 0),
   * `HIGH` = the new end (to the bigint maximum). null: the serial is NOT NULL.
   */
  draft: 'LOW' | 'HIGH' | null;
}

// ck_svh_status, ck_sb_status / ck_sdc_status / ck_sdr_status / ck_sr_status,
// ck_sq_status, ck_so_status and the avh_voucher_status CHECK.
const STOCK_STATUSES = ['DRAFT', 'POSTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;
const POSTING_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
const QUOTATION_STATUSES = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED',
  'CANCELLED',
] as const;
const ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'PARTIAL',
  'COMPLETED',
  'CANCELLED',
  'CLOSED',
  'EXPIRED',
] as const;
const VOUCHER_STATUSES = ['DRAFT', 'APPROVED', 'POSTED', 'CANCELLED'] as const;

/** `fixed.menu_master.menu_id` of the stock screens (no constant for them elsewhere). */
const STOCK_MENU_ID = {
  OPENING: 44,
  PHYSICAL: 45,
  TRANSFER: 41,
  ADJUSTMENT: 264,
} as const;
/** Quotation's menu: SALES_MENU_ID has no entry for it. */
const QUOTATION_MENU_ID = 14;

function stockVoucher(
  label: string,
  types: readonly string[],
  menu: number,
  where?: string,
): TxnDocSpec {
  return {
    label,
    table: 'stock.stock_voucher',
    id: 'svh_id',
    company: 'svh_company_id',
    branch: 'svh_branch_id',
    year: 'svh_acc_year',
    date: 'svh_doc_date',
    // svh_slno is counted per DEVICE (ux_svh_slno: company, branch, year,
    // type, device — the numbering helper's "the device is the counter"), so
    // it never goes in the key. The refno is counted per branch at the first
    // save, as created_on is stamped: `(date, created_on, id)` follows it.
    serial: null,
    createdOn: 'svh_created_on',
    status: 'svh_status',
    deleted: 'svh_is_deleted',
    refno: 'svh_refno',
    type: 'h.svh_voucher_type',
    types,
    where,
    statuses: STOCK_STATUSES,
    menu,
  };
}

/**
 * A sales header: `<p>_id`, `<p>_company_id` … `<p>_doc_type`; the date, serial
 * and refno are named per table. The serial and the refno are one number from
 * `allocateVoucherNumber` at the first save; `own.slno` names it when that
 * number comes from the branch's shared 'MAIN' series (the order, quotation,
 * DC, DC return and sales return pass no deviceCode), so it is branch-wide,
 * NOT NULL and in entry order. null where a device series can own it.
 */
function salesDoc(
  label: string,
  table: string,
  p: string,
  own: { date: string; slno: string | null; refno: string },
  statuses: readonly string[],
  menu: number,
): TxnDocSpec {
  return {
    label,
    table,
    id: `${p}_id`,
    company: `${p}_company_id`,
    branch: `${p}_branch_id`,
    year: `${p}_acc_year`,
    date: own.date,
    serial: own.slno === null ? null : { column: own.slno, draft: null },
    createdOn: `${p}_created_on`,
    status: `${p}_status`,
    deleted: `${p}_is_deleted`,
    refno: own.refno,
    type: `h.${p}_doc_type`,
    statuses,
    menu,
  };
}

/** `fixed.menu_master.menu_id` of the purchase screens (their services own the same numbers). */
const PURCHASE_MENU_ID = {
  ORDER: 23,
  INVOICE: 24,
  RETURN: 25,
  SHORTAGE_RECEIPT: 195,
  GRN: 196,
} as const;

/**
 * A purchase header (`purchase.pur_*`): `<p>_id`, `<p>_company_id` … `<p>_refno`,
 * dated by `<p>_doc_date`. The serial is counted per DEVICE (the refno carries
 * the device code, PUR/2026-2027/D14/…), so it stays out of the key — entry
 * order it is (notes 152). These tables keep no type column: `type` names the
 * column that best tells two documents of the docType apart (the bill's mode,
 * the return's kind) or, where there is none, the status.
 */
function purchaseDoc(label: string, table: string, p: string, type: string, menu: number): TxnDocSpec {
  return {
    label,
    table,
    id: `${p}_id`,
    company: `${p}_company_id`,
    branch: `${p}_branch_id`,
    year: `${p}_acc_year`,
    date: `${p}_doc_date`,
    serial: null,
    createdOn: `${p}_created_on`,
    status: `${p}_status`,
    deleted: `${p}_is_deleted`,
    refno: `${p}_refno`,
    type: `h.${type}`,
    statuses: POSTING_STATUSES,
    menu,
  };
}

const VOUCHER_COLUMNS = {
  table: 'accounts.acc_voucher_header',
  join: 'JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id',
  id: 'avh_voucher_id',
  company: 'avh_company_id',
  branch: 'avh_branch_id',
  year: 'avh_acc_year',
  date: 'avh_voucher_date',
  createdOn: 'avh_created_on',
  status: 'avh_voucher_status',
  deleted: 'avh_is_deleted',
  refno: 'avh_voucher_refno',
  type: 'vt.vchr_type_code',
  statuses: VOUCHER_STATUSES,
} as const;
/**
 * The COMPANY-wide running serial, given at post (ux_avh_voucher_slno:
 * company, year, among non-drafts): one series for every device, and the
 * order the registers draw. It goes in the key; each voucher docType says
 * where its drafts sort.
 */
const VOUCHER_SERIAL = 'avh_voucher_slno';

/**
 * A module voucher (Receipt, Payment): the rules of its own `/adjacent` —
 * its one type, its screen's menu, never a PDC child or a reversal
 * (`avh_against_voucher_id` names both), and drafts at the NEW end of their
 * date, as those registers draw them.
 */
function moduleVoucher(label: string, typeCode: string, menu: number): TxnDocSpec {
  return {
    ...VOUCHER_COLUMNS,
    label,
    types: [typeCode],
    where: 'h.avh_against_voucher_id IS NULL',
    serial: { column: VOUCHER_SERIAL, draft: 'HIGH' },
    menu,
  };
}

export const TXN_DOC_REGISTRY: Readonly<Record<TxnDocType, TxnDocSpec>> = {
  OPENING_STOCK: stockVoucher('opening stock voucher', ['OPENING'], STOCK_MENU_ID.OPENING),
  // One screen with a Type selector over four voucher types (grid 122 lists
  // them together); `typeCode` narrows the walk to one of them. A sale bill's
  // stock movement is an ISSUE too, and grid 122 leaves it out: it belongs to
  // the bill, not to this screen.
  STOCK_ADJUSTMENT: stockVoucher(
    'stock adjustment',
    STOCK_ADJUSTMENT_KINDS,
    STOCK_MENU_ID.ADJUSTMENT,
    "COALESCE(h.svh_link_src_module, 'STOCK') = 'STOCK'",
  ),
  PHYSICAL_STOCK: stockVoucher('physical stock voucher', ['PHYSICAL'], STOCK_MENU_ID.PHYSICAL),
  // The despatch and the receipt are two screens over one menu.
  STOCK_TRANSFER: stockVoucher('stock transfer', ['TRANSFER_OUT'], STOCK_MENU_ID.TRANSFER),
  STOCK_TRANSFER_RECEIPT: stockVoucher('transfer receipt', ['TRANSFER_IN'], STOCK_MENU_ID.TRANSFER),

  // A POS bill's number comes from the DEVICE's own series when the branch
  // sets posSeriesPerDevice (bill.service createBillInTx), a wholesale bill's
  // from the branch 'MAIN' series: one table, two scopes, so sb_bill_slno
  // cannot order a date's bills (notes 152). Entry order it is — a draft
  // bill, with or without a number, sits where it was raised.
  SALE_BILL: salesDoc(
    'sale bill',
    'sales.sale_bill',
    'sb',
    { date: 'sb_bill_date', slno: null, refno: 'sb_bill_refno' },
    POSTING_STATUSES,
    SALES_MENU_ID.SALE_BILL,
  ),
  QUOTATION: salesDoc(
    'quotation',
    'sales.sale_quotation',
    'sq',
    { date: 'sq_quote_date', slno: 'sq_quote_slno', refno: 'sq_quote_refno' },
    QUOTATION_STATUSES,
    QUOTATION_MENU_ID,
  ),
  SALE_ORDER: salesDoc(
    'sales order',
    'sales.sale_order',
    'so',
    { date: 'so_order_date', slno: 'so_order_slno', refno: 'so_order_refno' },
    ORDER_STATUSES,
    SALES_MENU_ID.SALES_ORDER,
  ),
  DELIVERY_CHALLAN: salesDoc(
    'delivery challan',
    'sales.sale_dc',
    'sdc',
    { date: 'sdc_dc_date', slno: 'sdc_dc_slno', refno: 'sdc_dc_refno' },
    POSTING_STATUSES,
    SALES_MENU_ID.DELIVERY_CHALLAN,
  ),
  DC_RETURN: salesDoc(
    'DC return',
    'sales.sale_dc_return',
    'sdr',
    { date: 'sdr_return_date', slno: 'sdr_return_slno', refno: 'sdr_return_refno' },
    POSTING_STATUSES,
    SALES_MENU_ID.DC_RETURN,
  ),
  SALE_RETURN: salesDoc(
    'sales return',
    'sales.sale_return',
    'sr',
    { date: 'sr_return_date', slno: 'sr_return_slno', refno: 'sr_return_refno' },
    POSTING_STATUSES,
    SALES_MENU_ID.SALE_RETURN,
  ),

  RECEIPT: moduleVoucher('receipt', RECEIPT_VOUCHER_TYPE_CODE, RECEIPT_MENU_ID),
  PAYMENT: moduleVoucher('payment', PAYMENT_VOUCHER_TYPE_CODE, PAYMENT_MENU_ID),
  // The Voucher Register: `vchr_in_register` types only (a `Rev` mirror or a
  // goods document is never a stop), each read on its own type's menu, and a
  // draft at the OLD end of its date — grid 117 sorts the serial DESC NULLS LAST.
  VOUCHER: {
    ...VOUCHER_COLUMNS,
    label: 'voucher',
    where: 'vt.vchr_in_register = true',
    serial: { column: VOUCHER_SERIAL, draft: 'LOW' },
    menu: 'VOUCHER_TYPE',
  },

  PURCHASE_ORDER: purchaseDoc('purchase order', 'purchase.pur_order', 'po', 'po_status', PURCHASE_MENU_ID.ORDER),
  GRN: purchaseDoc('GRN', 'purchase.pur_grn', 'grn', 'grn_status', PURCHASE_MENU_ID.GRN),
  PURCHASE_BILL: purchaseDoc('purchase bill', 'purchase.pur_invoice', 'pi', 'pi_mode', PURCHASE_MENU_ID.INVOICE),
  PURCHASE_RETURN: purchaseDoc('purchase return', 'purchase.pur_return', 'pr', 'pr_kind', PURCHASE_MENU_ID.RETURN),
  SHORTAGE_RECEIPT: purchaseDoc('shortage receipt', 'purchase.pur_shortage_receipt', 'psr', 'psr_status', PURCHASE_MENU_ID.SHORTAGE_RECEIPT),
};
