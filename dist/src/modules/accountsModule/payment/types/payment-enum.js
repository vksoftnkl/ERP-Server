"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_ADVANCE_SRC_DOC_TYPE = exports.PAYMENT_SRC_DOC_TYPE = exports.PAYMENT_SRC_MODULE = exports.PAYMENT_MENU_ID = exports.PAYMENT_VOUCHER_TYPE_CODE = exports.ReceiptBillSort = exports.PaymentSettingKey = exports.PAYMENT_REDUCTION_ROLE = exports.PAYMENT_ROLE_SETTLEMENT_MODE = exports.PAYMENT_ROLE_SIDE = exports.PaymentLedgerRole = exports.HELD_DEBIT_BILL_TYPES = exports.PAYABLE_BILL_TYPES = exports.VoucherStatus = exports.VoucherDeviceType = exports.VOUCHER_STATUSES = exports.PaymentBillSort = exports.PdcTraType = exports.PdcStatus = exports.PdcPostingMode = exports.PdcInstrumentType = exports.FREE_LEDGER_SETTLEMENT_MODE = exports.DrCr = exports.CHEQUE_TENDER_TYPE_ID = exports.CANCELLABLE_PDC_STATUSES = exports.BillType = exports.BillStatus = exports.BillSettlementMode = exports.BillAdjType = void 0;
exports.debitRouting = debitRouting;
const receipt_enum_1 = require("../../receipt/types/receipt-enum");
Object.defineProperty(exports, "ReceiptBillSort", { enumerable: true, get: function () { return receipt_enum_1.ReceiptBillSort; } });
var receipt_enum_2 = require("../../receipt/types/receipt-enum");
Object.defineProperty(exports, "BillAdjType", { enumerable: true, get: function () { return receipt_enum_2.BillAdjType; } });
Object.defineProperty(exports, "BillSettlementMode", { enumerable: true, get: function () { return receipt_enum_2.BillSettlementMode; } });
Object.defineProperty(exports, "BillStatus", { enumerable: true, get: function () { return receipt_enum_2.BillStatus; } });
Object.defineProperty(exports, "BillType", { enumerable: true, get: function () { return receipt_enum_2.BillType; } });
Object.defineProperty(exports, "CANCELLABLE_PDC_STATUSES", { enumerable: true, get: function () { return receipt_enum_2.CANCELLABLE_PDC_STATUSES; } });
Object.defineProperty(exports, "CHEQUE_TENDER_TYPE_ID", { enumerable: true, get: function () { return receipt_enum_2.CHEQUE_TENDER_TYPE_ID; } });
Object.defineProperty(exports, "DrCr", { enumerable: true, get: function () { return receipt_enum_2.DrCr; } });
Object.defineProperty(exports, "FREE_LEDGER_SETTLEMENT_MODE", { enumerable: true, get: function () { return receipt_enum_2.FREE_LEDGER_SETTLEMENT_MODE; } });
Object.defineProperty(exports, "PdcInstrumentType", { enumerable: true, get: function () { return receipt_enum_2.PdcInstrumentType; } });
Object.defineProperty(exports, "PdcPostingMode", { enumerable: true, get: function () { return receipt_enum_2.PdcPostingMode; } });
Object.defineProperty(exports, "PdcStatus", { enumerable: true, get: function () { return receipt_enum_2.PdcStatus; } });
Object.defineProperty(exports, "PdcTraType", { enumerable: true, get: function () { return receipt_enum_2.PdcTraType; } });
Object.defineProperty(exports, "PaymentBillSort", { enumerable: true, get: function () { return receipt_enum_2.ReceiptBillSort; } });
Object.defineProperty(exports, "VOUCHER_STATUSES", { enumerable: true, get: function () { return receipt_enum_2.VOUCHER_STATUSES; } });
Object.defineProperty(exports, "VoucherDeviceType", { enumerable: true, get: function () { return receipt_enum_2.VoucherDeviceType; } });
Object.defineProperty(exports, "VoucherStatus", { enumerable: true, get: function () { return receipt_enum_2.VoucherStatus; } });
exports.PAYABLE_BILL_TYPES = [
    receipt_enum_1.BillType.PURCHASE,
    receipt_enum_1.BillType.OPENING,
    receipt_enum_1.BillType.JOURNAL,
];
exports.HELD_DEBIT_BILL_TYPES = [
    receipt_enum_1.BillType.ADVANCE,
    receipt_enum_1.BillType.PURCHASE_RETURN,
    receipt_enum_1.BillType.OPENING,
    receipt_enum_1.BillType.JOURNAL,
];
var PaymentLedgerRole;
(function (PaymentLedgerRole) {
    PaymentLedgerRole["TDS_PAYABLE"] = "TDS_PAYABLE";
    PaymentLedgerRole["BANK_CHARGES"] = "BANK_CHARGES";
    PaymentLedgerRole["INTEREST_PAID"] = "INTEREST_PAID";
    PaymentLedgerRole["BALANCES_WRITTEN_BACK"] = "BALANCES_WRITTEN_BACK";
    PaymentLedgerRole["DISCOUNT_RECEIVED"] = "DISCOUNT_RECEIVED";
    PaymentLedgerRole["ROUND_OFF"] = "ROUND_OFF";
    PaymentLedgerRole["ADVANCE_PAID"] = "ADVANCE_PAID";
})(PaymentLedgerRole || (exports.PaymentLedgerRole = PaymentLedgerRole = {}));
exports.PAYMENT_ROLE_SIDE = {
    [PaymentLedgerRole.TDS_PAYABLE]: receipt_enum_1.DrCr.CR,
    [PaymentLedgerRole.BANK_CHARGES]: receipt_enum_1.DrCr.DR,
    [PaymentLedgerRole.INTEREST_PAID]: receipt_enum_1.DrCr.DR,
    [PaymentLedgerRole.BALANCES_WRITTEN_BACK]: receipt_enum_1.DrCr.CR,
};
exports.PAYMENT_ROLE_SETTLEMENT_MODE = {
    [PaymentLedgerRole.TDS_PAYABLE]: receipt_enum_1.BillSettlementMode.TDS,
    [PaymentLedgerRole.BALANCES_WRITTEN_BACK]: receipt_enum_1.BillSettlementMode.WRITEOFF,
};
exports.PAYMENT_REDUCTION_ROLE = {
    discount: PaymentLedgerRole.DISCOUNT_RECEIVED,
    writeoff: PaymentLedgerRole.BALANCES_WRITTEN_BACK,
    roundoff: PaymentLedgerRole.ROUND_OFF,
};
function debitRouting(billType) {
    return billType === receipt_enum_1.BillType.PURCHASE_RETURN
        ? { adjType: receipt_enum_1.BillAdjType.NOTE_ADJUST, settlementMode: receipt_enum_1.BillSettlementMode.CREDIT_NOTE }
        : { adjType: receipt_enum_1.BillAdjType.ADVANCE_ADJUST, settlementMode: receipt_enum_1.BillSettlementMode.ADVANCE };
}
var PaymentSettingKey;
(function (PaymentSettingKey) {
    PaymentSettingKey["PDC_POSTING_MODE"] = "accounts.pdc_posting_mode";
    PaymentSettingKey["BILL_SORT"] = "accounts.receipt_bill_sort";
    PaymentSettingKey["SALESMAN_MANDATORY"] = "accounts.payment_salesman_mandatory";
    PaymentSettingKey["WRITEOFF_APPROVAL_ABOVE"] = "accounts.writeoff_approval_above";
    PaymentSettingKey["ALLOW_POSTED_AMEND"] = "accounts.allow_posted_amend";
})(PaymentSettingKey || (exports.PaymentSettingKey = PaymentSettingKey = {}));
exports.PAYMENT_VOUCHER_TYPE_CODE = 'Pmt';
exports.PAYMENT_MENU_ID = 100;
exports.PAYMENT_SRC_MODULE = 'ACCOUNTS';
exports.PAYMENT_SRC_DOC_TYPE = 'PAYMENT';
exports.PAYMENT_ADVANCE_SRC_DOC_TYPE = 'PAYMENT_ADVANCE';
//# sourceMappingURL=payment-enum.js.map