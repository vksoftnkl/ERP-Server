"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertChequesStillHeld = assertChequesStillHeld;
exports.assertAdvancesUntouched = assertAdvancesUntouched;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("./types/receipt-enum");
const receipt_cheque_links_1 = require("./receipt-cheque-links");
const receipt_utils_1 = require("./receipt.utils");
function refusal(verb) {
    return `Receipt cannot be ${verb}`;
}
async function assertChequesStillHeld(tx, scope, verb) {
    const moved = await tx.accPdcRegister.findMany({
        where: {
            ...(await (0, receipt_cheque_links_1.receiptChequeFilter)(tx, scope)),
            apdIsDeleted: false,
            apdStatus: { notIn: [...receipt_enum_1.CANCELLABLE_PDC_STATUSES] },
        },
        select: { apdInstrumentNo: true, apdStatus: true },
    });
    if (moved.length > 0) {
        const first = moved[0];
        (0, module_service_utils_1.throwAccountsConflict)(refusal(verb), [
            {
                field: 'avhVoucherId',
                message: `Cheque ${first.apdInstrumentNo} is ${first.apdStatus}. Once an instrument has left ` +
                    'the drawer the receipt behind it cannot be unmade — unwind it on the Received ' +
                    'Cheques screen first.',
            },
        ]);
    }
}
async function assertAdvancesUntouched(tx, voucherIds, years, verb) {
    const advances = await tx.accBillBalance.findMany({
        where: {
            ablVoucherId: { in: [...voucherIds] },
            ablAccYear: { in: [...years] },
            ablBillType: receipt_enum_1.BillType.ADVANCE,
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
                    message: `The on-account balance from ${advance.ablDocRefno} has already been used — ` +
                        `${advance.ablBillAmount.minus(pending).toFixed(2)} of it is settling another bill. ` +
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
//# sourceMappingURL=receipt-unwind.guards.js.map