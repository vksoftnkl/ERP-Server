"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertIssuedChequesStillHeld = assertIssuedChequesStillHeld;
exports.assertNoSettledTransfer = assertNoSettledTransfer;
exports.assertAdvancesUntouched = assertAdvancesUntouched;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const payment_enum_1 = require("./types/payment-enum");
const payment_cheque_links_1 = require("./payment-cheque-links");
const receipt_utils_1 = require("../receipt/receipt.utils");
function refusal(verb) {
    return `Payment cannot be ${verb}`;
}
async function assertIssuedChequesStillHeld(tx, scope, verb) {
    const moved = await tx.accPdcRegister.findMany({
        where: {
            ...(await (0, payment_cheque_links_1.paymentChequeFilter)(tx, scope)),
            apdIsDeleted: false,
            apdStatus: { notIn: [...payment_enum_1.CANCELLABLE_PDC_STATUSES] },
        },
        select: { apdInstrumentNo: true, apdStatus: true },
    });
    if (moved.length > 0) {
        const first = moved[0];
        (0, module_service_utils_1.throwAccountsConflict)(refusal(verb), [
            {
                field: 'avhVoucherId',
                message: `Cheque ${first.apdInstrumentNo} is ${first.apdStatus}. Once our cheque has been acted on ` +
                    `the payment behind it cannot be ${verb} here — unwind it on the Issued Cheques screen ` +
                    '(menu 52) first.',
            },
        ]);
    }
}
async function assertNoSettledTransfer(tx, paymentVoucherId, verb) {
    const settled = await tx.accTenderDetail.findFirst({
        where: { tdSrcDocId: paymentVoucherId, tdIsDeleted: false, tdSettleStatus: 'SETTLED' },
        select: { tdRowNo: true, tdRefNo: true, tdSettledOn: true },
    });
    if (settled) {
        (0, module_service_utils_1.throwAccountsConflict)(refusal(verb), [
            {
                field: 'avhVoucherId',
                message: `Tender row ${settled.tdRowNo}${settled.tdRefNo ? ` (${settled.tdRefNo})` : ''} is SETTLED ` +
                    `by the bank${settled.tdSettledOn ? ` on ${settled.tdSettledOn.toISOString().slice(0, 10)}` : ''}. ` +
                    `A payment the bank has cleared cannot be ${verb} — reverse it with a receipt from the party.`,
            },
        ]);
    }
}
async function assertAdvancesUntouched(tx, voucherIds, years, verb) {
    const advances = await tx.accBillBalance.findMany({
        where: {
            ablVoucherId: { in: [...voucherIds] },
            ablAccYear: { in: [...years] },
            ablBillType: payment_enum_1.BillType.ADVANCE,
            ablIsDeleted: false,
        },
        select: {
            ablId: true,
            ablAccYear: true,
            ablDocRefno: true,
            ablBillAmount: true,
            ablPendingAmount: true,
        },
    });
    for (const advance of advances) {
        const pending = advance.ablPendingAmount ?? receipt_utils_1.ZERO;
        if (!pending.equals(advance.ablBillAmount)) {
            (0, module_service_utils_1.throwAccountsConflict)(refusal(verb), [
                {
                    field: 'avhVoucherId',
                    message: `The advance from ${advance.ablDocRefno} has already been used — ` +
                        `${advance.ablBillAmount.minus(pending).toFixed(2)} of it is settling a purchase bill. ` +
                        'Reverse that settlement first.',
                },
            ]);
        }
    }
    return advances.map((advance) => ({
        ablId: advance.ablId,
        ablAccYear: advance.ablAccYear,
        ablDocRefno: advance.ablDocRefno,
    }));
}
//# sourceMappingURL=payment-unwind.guards.js.map