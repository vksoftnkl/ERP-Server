"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECEIPT_PRINT_PURPOSE_CODE = exports.ADVANCE_SRC_DOC_TYPE = exports.RECEIPT_SRC_DOC_TYPE = exports.RECEIPT_SRC_MODULE = exports.RECEIPT_VOUCHER_TYPE_CODE = exports.TcsBasis = exports.ReceiptBillSort = exports.ReceiptSettingKey = exports.FREE_LEDGER_SETTLEMENT_MODE = exports.ROLE_SETTLEMENT_MODE = exports.ROLE_SIDE = exports.ReceiptLedgerRole = exports.CHEQUE_TENDER_TYPE_ID = exports.PdcPostingMode = exports.CANCELLABLE_PDC_STATUSES = exports.PdcStatus = exports.PdcInstrumentType = exports.PdcTraType = exports.BillSettlementMode = exports.ALLOCATING_ADJ_TYPES = exports.BillAdjType = exports.CREDIT_BILL_TYPES = exports.RECEIVABLE_BILL_TYPES = exports.BillStatus = exports.BillType = exports.DrCr = exports.VOUCHER_STATUSES = exports.VoucherDeviceType = exports.VoucherStatus = void 0;
var VoucherStatus;
(function (VoucherStatus) {
    VoucherStatus["DRAFT"] = "DRAFT";
    VoucherStatus["APPROVED"] = "APPROVED";
    VoucherStatus["POSTED"] = "POSTED";
    VoucherStatus["CANCELLED"] = "CANCELLED";
})(VoucherStatus || (exports.VoucherStatus = VoucherStatus = {}));
var VoucherDeviceType;
(function (VoucherDeviceType) {
    VoucherDeviceType["PC"] = "PC";
    VoucherDeviceType["WEB"] = "WEB";
    VoucherDeviceType["MOBILE"] = "MOBILE";
    VoucherDeviceType["POS"] = "POS";
    VoucherDeviceType["DESKTOP"] = "DESKTOP";
})(VoucherDeviceType || (exports.VoucherDeviceType = VoucherDeviceType = {}));
exports.VOUCHER_STATUSES = Object.values(VoucherStatus);
var DrCr;
(function (DrCr) {
    DrCr["DR"] = "DR";
    DrCr["CR"] = "CR";
})(DrCr || (exports.DrCr = DrCr = {}));
var BillType;
(function (BillType) {
    BillType["SALES"] = "SALES";
    BillType["PURCHASE"] = "PURCHASE";
    BillType["SALES_RETURN"] = "SALES_RETURN";
    BillType["PURCHASE_RETURN"] = "PURCHASE_RETURN";
    BillType["OPENING"] = "OPENING";
    BillType["ADVANCE"] = "ADVANCE";
    BillType["INTEREST"] = "INTEREST";
    BillType["JOURNAL"] = "JOURNAL";
})(BillType || (exports.BillType = BillType = {}));
var BillStatus;
(function (BillStatus) {
    BillStatus["OPEN"] = "OPEN";
    BillStatus["PARTIAL"] = "PARTIAL";
    BillStatus["CLOSED"] = "CLOSED";
})(BillStatus || (exports.BillStatus = BillStatus = {}));
exports.RECEIVABLE_BILL_TYPES = [
    BillType.SALES,
    BillType.OPENING,
    BillType.INTEREST,
    BillType.JOURNAL,
    BillType.PURCHASE_RETURN,
];
exports.CREDIT_BILL_TYPES = [BillType.ADVANCE, BillType.SALES_RETURN];
var BillAdjType;
(function (BillAdjType) {
    BillAdjType["ALLOCATION"] = "ALLOCATION";
    BillAdjType["ADVANCE_ADJUST"] = "ADVANCE_ADJUST";
    BillAdjType["NOTE_ADJUST"] = "NOTE_ADJUST";
    BillAdjType["DISCOUNT"] = "DISCOUNT";
    BillAdjType["WRITEOFF"] = "WRITEOFF";
    BillAdjType["TRANSFER"] = "TRANSFER";
})(BillAdjType || (exports.BillAdjType = BillAdjType = {}));
exports.ALLOCATING_ADJ_TYPES = [
    BillAdjType.ALLOCATION,
    BillAdjType.ADVANCE_ADJUST,
    BillAdjType.NOTE_ADJUST,
    BillAdjType.TRANSFER,
];
var BillSettlementMode;
(function (BillSettlementMode) {
    BillSettlementMode["CASH"] = "CASH";
    BillSettlementMode["CARD"] = "CARD";
    BillSettlementMode["UPI"] = "UPI";
    BillSettlementMode["WALLET"] = "WALLET";
    BillSettlementMode["CHEQUE"] = "CHEQUE";
    BillSettlementMode["BANK"] = "BANK";
    BillSettlementMode["CREDIT_NOTE"] = "CREDIT_NOTE";
    BillSettlementMode["ADVANCE"] = "ADVANCE";
    BillSettlementMode["LOYALTY"] = "LOYALTY";
    BillSettlementMode["VOUCHER"] = "VOUCHER";
    BillSettlementMode["JOURNAL"] = "JOURNAL";
    BillSettlementMode["DISCOUNT"] = "DISCOUNT";
    BillSettlementMode["WRITEOFF"] = "WRITEOFF";
    BillSettlementMode["MIXED"] = "MIXED";
    BillSettlementMode["TDS"] = "TDS";
    BillSettlementMode["CLAIM"] = "CLAIM";
})(BillSettlementMode || (exports.BillSettlementMode = BillSettlementMode = {}));
var PdcTraType;
(function (PdcTraType) {
    PdcTraType["RECEIVED"] = "R";
    PdcTraType["PAID"] = "P";
})(PdcTraType || (exports.PdcTraType = PdcTraType = {}));
var PdcInstrumentType;
(function (PdcInstrumentType) {
    PdcInstrumentType["CHEQUE"] = "CHEQUE";
    PdcInstrumentType["DD"] = "DD";
    PdcInstrumentType["PAY_ORDER"] = "PAY_ORDER";
    PdcInstrumentType["ECS"] = "ECS";
    PdcInstrumentType["NACH"] = "NACH";
    PdcInstrumentType["UPI_MANDATE"] = "UPI_MANDATE";
})(PdcInstrumentType || (exports.PdcInstrumentType = PdcInstrumentType = {}));
var PdcStatus;
(function (PdcStatus) {
    PdcStatus["HELD"] = "HELD";
    PdcStatus["DEPOSITED"] = "DEPOSITED";
    PdcStatus["CLEARED"] = "CLEARED";
    PdcStatus["BOUNCED"] = "BOUNCED";
    PdcStatus["RETURNED"] = "RETURNED";
    PdcStatus["CANCELLED"] = "CANCELLED";
    PdcStatus["REPLACED"] = "REPLACED";
})(PdcStatus || (exports.PdcStatus = PdcStatus = {}));
exports.CANCELLABLE_PDC_STATUSES = [PdcStatus.HELD];
var PdcPostingMode;
(function (PdcPostingMode) {
    PdcPostingMode["ON_RECEIPT"] = "ON_RECEIPT";
    PdcPostingMode["ON_CLEARING"] = "ON_CLEARING";
})(PdcPostingMode || (exports.PdcPostingMode = PdcPostingMode = {}));
exports.CHEQUE_TENDER_TYPE_ID = 5;
var ReceiptLedgerRole;
(function (ReceiptLedgerRole) {
    ReceiptLedgerRole["TDS_RECEIVABLE"] = "TDS_RECEIVABLE";
    ReceiptLedgerRole["BANK_CHARGES"] = "BANK_CHARGES";
    ReceiptLedgerRole["SURCHARGE_RECOVERED"] = "SURCHARGE_RECOVERED";
    ReceiptLedgerRole["CLAIMS_ALLOWED"] = "CLAIMS_ALLOWED";
    ReceiptLedgerRole["INTEREST_INCOME"] = "INTEREST_INCOME";
    ReceiptLedgerRole["DISCOUNT_ALLOWED"] = "DISCOUNT_ALLOWED";
    ReceiptLedgerRole["WRITE_OFF"] = "WRITE_OFF";
    ReceiptLedgerRole["TCS_PAYABLE"] = "TCS_PAYABLE";
})(ReceiptLedgerRole || (exports.ReceiptLedgerRole = ReceiptLedgerRole = {}));
exports.ROLE_SIDE = {
    [ReceiptLedgerRole.TDS_RECEIVABLE]: DrCr.DR,
    [ReceiptLedgerRole.BANK_CHARGES]: DrCr.DR,
    [ReceiptLedgerRole.SURCHARGE_RECOVERED]: DrCr.CR,
    [ReceiptLedgerRole.CLAIMS_ALLOWED]: DrCr.DR,
    [ReceiptLedgerRole.INTEREST_INCOME]: DrCr.CR,
    [ReceiptLedgerRole.DISCOUNT_ALLOWED]: DrCr.DR,
    [ReceiptLedgerRole.WRITE_OFF]: DrCr.DR,
    [ReceiptLedgerRole.TCS_PAYABLE]: DrCr.CR,
};
exports.ROLE_SETTLEMENT_MODE = {
    [ReceiptLedgerRole.TDS_RECEIVABLE]: BillSettlementMode.TDS,
    [ReceiptLedgerRole.CLAIMS_ALLOWED]: BillSettlementMode.CLAIM,
};
exports.FREE_LEDGER_SETTLEMENT_MODE = BillSettlementMode.JOURNAL;
var ReceiptSettingKey;
(function (ReceiptSettingKey) {
    ReceiptSettingKey["PDC_POSTING_MODE"] = "accounts.pdc_posting_mode";
    ReceiptSettingKey["BILL_SORT"] = "accounts.receipt_bill_sort";
    ReceiptSettingKey["SALESMAN_MANDATORY"] = "accounts.receipt_salesman_mandatory";
    ReceiptSettingKey["WRITEOFF_APPROVAL_ABOVE"] = "accounts.writeoff_approval_above";
    ReceiptSettingKey["TCS_BASIS"] = "accounts.tcs_basis";
    ReceiptSettingKey["PPD_SLABS"] = "accounts.ppd_slabs";
})(ReceiptSettingKey || (exports.ReceiptSettingKey = ReceiptSettingKey = {}));
var ReceiptBillSort;
(function (ReceiptBillSort) {
    ReceiptBillSort["DUE_DATE"] = "DUE_DATE";
    ReceiptBillSort["BILL_DATE"] = "BILL_DATE";
})(ReceiptBillSort || (exports.ReceiptBillSort = ReceiptBillSort = {}));
var TcsBasis;
(function (TcsBasis) {
    TcsBasis["RECEIPT"] = "RECEIPT";
    TcsBasis["SALES"] = "SALES";
})(TcsBasis || (exports.TcsBasis = TcsBasis = {}));
exports.RECEIPT_VOUCHER_TYPE_CODE = 'Rct';
exports.RECEIPT_SRC_MODULE = 'ACCOUNTS';
exports.RECEIPT_SRC_DOC_TYPE = 'RECEIPT';
exports.ADVANCE_SRC_DOC_TYPE = 'RECEIPT_ADVANCE';
exports.RECEIPT_PRINT_PURPOSE_CODE = 'RECEIPT_VOUCHER';
//# sourceMappingURL=receipt-enum.js.map