"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TXN_DOC_REGISTRY = exports.TXN_DOC_TYPES = void 0;
const payment_enum_1 = require("../accountsModule/payment/types/payment-enum");
const receipt_enum_1 = require("../accountsModule/receipt/types/receipt-enum");
const sales_doc_utils_1 = require("../sales/posting/sales-doc.utils");
const stock_adjustment_rules_1 = require("../stocks/stock-adjustment/stock-adjustment.rules");
exports.TXN_DOC_TYPES = [
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
];
const STOCK_STATUSES = ['DRAFT', 'POSTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'];
const POSTING_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const QUOTATION_STATUSES = [
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'CONVERTED',
    'CANCELLED',
];
const ORDER_STATUSES = [
    'DRAFT',
    'CONFIRMED',
    'PARTIAL',
    'COMPLETED',
    'CANCELLED',
    'CLOSED',
    'EXPIRED',
];
const VOUCHER_STATUSES = ['DRAFT', 'APPROVED', 'POSTED', 'CANCELLED'];
const STOCK_MENU_ID = {
    OPENING: 44,
    PHYSICAL: 45,
    TRANSFER: 41,
    ADJUSTMENT: 264,
};
const QUOTATION_MENU_ID = 14;
function stockVoucher(label, types, menu, where) {
    return {
        label,
        table: 'stock.stock_voucher',
        id: 'svh_id',
        company: 'svh_company_id',
        branch: 'svh_branch_id',
        year: 'svh_acc_year',
        date: 'svh_doc_date',
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
function salesDoc(label, table, p, own, statuses, menu) {
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
const PURCHASE_MENU_ID = {
    ORDER: 23,
    INVOICE: 24,
    RETURN: 25,
    SHORTAGE_RECEIPT: 195,
    GRN: 196,
};
function purchaseDoc(label, table, p, type, menu) {
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
};
const VOUCHER_SERIAL = 'avh_voucher_slno';
function moduleVoucher(label, typeCode, menu) {
    return {
        ...VOUCHER_COLUMNS,
        label,
        types: [typeCode],
        where: 'h.avh_against_voucher_id IS NULL',
        serial: { column: VOUCHER_SERIAL, draft: 'HIGH' },
        menu,
    };
}
exports.TXN_DOC_REGISTRY = {
    OPENING_STOCK: stockVoucher('opening stock voucher', ['OPENING'], STOCK_MENU_ID.OPENING),
    STOCK_ADJUSTMENT: stockVoucher('stock adjustment', stock_adjustment_rules_1.STOCK_ADJUSTMENT_KINDS, STOCK_MENU_ID.ADJUSTMENT, "COALESCE(h.svh_link_src_module, 'STOCK') = 'STOCK'"),
    PHYSICAL_STOCK: stockVoucher('physical stock voucher', ['PHYSICAL'], STOCK_MENU_ID.PHYSICAL),
    STOCK_TRANSFER: stockVoucher('stock transfer', ['TRANSFER_OUT'], STOCK_MENU_ID.TRANSFER),
    STOCK_TRANSFER_RECEIPT: stockVoucher('transfer receipt', ['TRANSFER_IN'], STOCK_MENU_ID.TRANSFER),
    SALE_BILL: salesDoc('sale bill', 'sales.sale_bill', 'sb', { date: 'sb_bill_date', slno: null, refno: 'sb_bill_refno' }, POSTING_STATUSES, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL),
    QUOTATION: salesDoc('quotation', 'sales.sale_quotation', 'sq', { date: 'sq_quote_date', slno: 'sq_quote_slno', refno: 'sq_quote_refno' }, QUOTATION_STATUSES, QUOTATION_MENU_ID),
    SALE_ORDER: salesDoc('sales order', 'sales.sale_order', 'so', { date: 'so_order_date', slno: 'so_order_slno', refno: 'so_order_refno' }, ORDER_STATUSES, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER),
    DELIVERY_CHALLAN: salesDoc('delivery challan', 'sales.sale_dc', 'sdc', { date: 'sdc_dc_date', slno: 'sdc_dc_slno', refno: 'sdc_dc_refno' }, POSTING_STATUSES, sales_doc_utils_1.SALES_MENU_ID.DELIVERY_CHALLAN),
    DC_RETURN: salesDoc('DC return', 'sales.sale_dc_return', 'sdr', { date: 'sdr_return_date', slno: 'sdr_return_slno', refno: 'sdr_return_refno' }, POSTING_STATUSES, sales_doc_utils_1.SALES_MENU_ID.DC_RETURN),
    SALE_RETURN: salesDoc('sales return', 'sales.sale_return', 'sr', { date: 'sr_return_date', slno: 'sr_return_slno', refno: 'sr_return_refno' }, POSTING_STATUSES, sales_doc_utils_1.SALES_MENU_ID.SALE_RETURN),
    RECEIPT: moduleVoucher('receipt', receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE, receipt_enum_1.RECEIPT_MENU_ID),
    PAYMENT: moduleVoucher('payment', payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE, payment_enum_1.PAYMENT_MENU_ID),
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
//# sourceMappingURL=txn-adjacent.registry.js.map