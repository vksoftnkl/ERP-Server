"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptChequeFilter = receiptChequeFilter;
exports.receiptPdcVoucherWhere = receiptPdcVoucherWhere;
async function receiptChequeFilter(tx, scope) {
    const tenders = await tx.accTenderDetail.findMany({
        where: { tdSrcDocId: scope.receiptVoucherId },
        select: { tdId: true },
    });
    const byVoucher = {
        apdVoucherId: { in: [...scope.voucherIds] },
    };
    if (tenders.length === 0) {
        return byVoucher;
    }
    return {
        OR: [byVoucher, { apdTenderId: { in: tenders.map((tender) => tender.tdId) } }],
    };
}
function receiptPdcVoucherWhere(header) {
    return {
        avhAgainstVoucherId: header.avhVoucherId,
        avhVoucherTypeId: header.avhVoucherTypeId,
        avhIsDeleted: false,
    };
}
//# sourceMappingURL=receipt-cheque-links.js.map