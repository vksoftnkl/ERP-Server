"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockBills = exports.assertVoucherPartitionExists = exports.assertAccYearWritable = exports.accYearOf = void 0;
exports.loadPayee = loadPayee;
exports.loadPaymentVoucherType = loadPaymentVoucherType;
exports.assertHeaderScope = assertHeaderScope;
exports.assertPayableUsable = assertPayableUsable;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const voucher_facts_1 = require("../vouchers/voucher-facts");
const receipt_guards_1 = require("../receipt/receipt.guards");
Object.defineProperty(exports, "accYearOf", { enumerable: true, get: function () { return receipt_guards_1.accYearOf; } });
Object.defineProperty(exports, "assertAccYearWritable", { enumerable: true, get: function () { return receipt_guards_1.assertAccYearWritable; } });
Object.defineProperty(exports, "assertVoucherPartitionExists", { enumerable: true, get: function () { return receipt_guards_1.assertVoucherPartitionExists; } });
Object.defineProperty(exports, "lockBills", { enumerable: true, get: function () { return receipt_guards_1.lockBills; } });
const payment_enum_1 = require("./types/payment-enum");
async function loadPayee(client, companyId, partyId, field = 'avhPartyId', options = {}) {
    const facts = (await (0, voucher_facts_1.loadLedgerFacts)(client, companyId, [partyId])).get(partyId);
    if (!facts || facts.isDeleted) {
        (0, module_service_utils_1.throwAccountsNotFound)('Party not found', field, `No ledger ${partyId} is visible to this company`);
    }
    if (!facts.isActive) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field, message: `"${facts.name}" is inactive and cannot be paid` },
        ]);
    }
    const money = (0, voucher_facts_1.isMoneyLedger)(facts);
    if (money && !options.allowMoneyLedger) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `"${facts.name}" is a cash / bank ledger (${facts.groupName}). Moving money between ` +
                    'cash and bank is a Contra — use the Voucher Register, not a payment.',
            },
        ]);
    }
    return {
        ledId: facts.ledId,
        ledName: facts.name,
        ledIsBillByBill: facts.isBillByBill,
        ledIsTdsApplicable: facts.isTdsApplicable,
        ledTdsSection: facts.tdsSection?.trim() || null,
        ledTdsDeducteeType: facts.tdsDeducteeType,
        ledPanNo: facts.pan?.trim() || null,
        groupName: facts.groupName || null,
        isMoneyLedger: money,
    };
}
async function loadPaymentVoucherType(client) {
    const type = await client.accVoucherType.findFirst({
        where: { vchrTypeCode: payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE },
        select: { vchrTypeId: true, vchrTypeCode: true, vchrTypeName: true, vchrIsActive: true },
    });
    if (!type || !type.vchrIsActive) {
        (0, module_service_utils_1.throwAccountsNotFound)('Payment voucher type is not configured', 'avhVoucherTypeId', `accounts.acc_voucher_types has no active row with vchr_type_code = '${payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE}'. ` +
            'Run migration 20260929090000.');
    }
    return {
        vchrTypeId: type.vchrTypeId,
        vchrTypeCode: type.vchrTypeCode,
        vchrTypeName: type.vchrTypeName,
    };
}
function assertHeaderScope(header, keys) {
    if (header.avhCompanyId !== keys.companyId ||
        header.avhBranchId !== keys.branchId ||
        header.avhAccYear !== keys.accYear) {
        (0, module_service_utils_1.throwAccountsNotFound)('Payment not found', 'avhVoucherId', `No payment ${keys.voucherId} at this company / branch / year`);
    }
}
function assertPayableUsable(bill, expect) {
    if (!bill || bill.ablIsDeleted) {
        (0, module_service_utils_1.throwAccountsNotFound)('Bill not found', expect.field, `No live bill ${expect.billId}`);
    }
    if (bill.ablPartyId !== expect.partyId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field: expect.field, message: `Bill ${bill.ablDocRefno} belongs to another party` },
        ]);
    }
    if (bill.ablCompanyId !== expect.companyId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field: expect.field, message: `Bill ${bill.ablDocRefno} belongs to another company` },
        ]);
    }
    const allowed = expect.kind === 'PAYABLE' ? payment_enum_1.PAYABLE_BILL_TYPES : payment_enum_1.HELD_DEBIT_BILL_TYPES;
    if (!allowed.includes(bill.ablBillType)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: expect.field,
                message: `Bill ${bill.ablDocRefno} is a ${bill.ablBillType} bill and cannot be settled as ` +
                    `${expect.kind === 'PAYABLE' ? 'a payable' : 'a debit we hold'} by a payment`,
            },
        ]);
    }
    const wantSide = expect.kind === 'PAYABLE' ? 'CR' : 'DR';
    if (bill.ablDrCr !== wantSide) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: expect.field,
                message: `Bill ${bill.ablDocRefno} sits on the ${bill.ablDrCr} side of this party's account, ` +
                    `and a ${expect.kind === 'PAYABLE' ? 'payable' : 'held debit'} must be ${wantSide}`,
            },
        ]);
    }
    return bill;
}
//# sourceMappingURL=payment.guards.js.map