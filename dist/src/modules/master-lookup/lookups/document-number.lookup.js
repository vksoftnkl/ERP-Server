"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentNumberLookup = void 0;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const DOCUMENT_LABELS = {
    saleBill: 'Sale bill',
    saleOrder: 'Sale order',
    saleQuotation: 'Sale quotation',
};
const DOCUMENT_RESOLVERS = {
    saleBill: async (prisma, { refno, slno, companyId, branchId }) => {
        const row = await prisma.saleBill.findFirst({
            where: {
                sbCompanyId: companyId,
                sbBranchId: branchId,
                sbIsDeleted: false,
                OR: [{ sbBillRefno: refno }, ...(slno === null ? [] : [{ sbBillSlno: slno }])],
            },
            select: { sbId: true, sbCompanyId: true, sbBranchId: true, sbAccYear: true },
            orderBy: [{ sbAccYear: 'desc' }, { sbBillDate: 'desc' }, { sbId: 'desc' }],
        });
        return row
            ? {
                id: row.sbId,
                companyId: row.sbCompanyId,
                branchId: row.sbBranchId,
                accYear: row.sbAccYear,
            }
            : null;
    },
    saleOrder: async (prisma, { refno, slno, companyId, branchId }) => {
        const row = await prisma.saleOrder.findFirst({
            where: {
                soCompanyId: companyId,
                soBranchId: branchId,
                soIsDeleted: false,
                OR: [{ soOrderRefno: refno }, ...(slno === null ? [] : [{ soOrderSlno: slno }])],
            },
            select: { soId: true, soCompanyId: true, soBranchId: true, soAccYear: true },
            orderBy: [{ soAccYear: 'desc' }, { soOrderDate: 'desc' }, { soId: 'desc' }],
        });
        return row
            ? {
                id: row.soId,
                companyId: row.soCompanyId,
                branchId: row.soBranchId,
                accYear: row.soAccYear,
            }
            : null;
    },
    saleQuotation: async (prisma, { refno, slno, companyId, branchId }) => {
        const row = await prisma.saleQuotation.findFirst({
            where: {
                sqCompanyId: companyId,
                sqBranchId: branchId,
                sqIsDeleted: false,
                OR: [{ sqQuoteRefno: refno }, ...(slno === null ? [] : [{ sqQuoteSlno: slno }])],
            },
            select: { sqId: true, sqCompanyId: true, sqBranchId: true, sqAccYear: true },
            orderBy: [{ sqAccYear: 'desc' }, { sqRevisionNo: 'desc' }, { sqId: 'desc' }],
        });
        return row
            ? {
                id: row.sqId,
                companyId: row.sqCompanyId,
                branchId: row.sqBranchId,
                accYear: row.sqAccYear,
            }
            : null;
    },
};
class DocumentNumberLookup {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDocumentByNumber(query) {
        const { module, orderNo, companyId, branchId } = query;
        const row = await DOCUMENT_RESOLVERS[module](this.prisma, {
            refno: orderNo,
            slno: toSerial(orderNo),
            companyId,
            branchId,
        });
        if (!row) {
            (0, module_service_utils_1.throwMasterNotFound)(`${DOCUMENT_LABELS[module]} not found`, 'orderNo', `No ${DOCUMENT_LABELS[module].toLowerCase()} found for number ${orderNo} in company ${companyId} / branch ${branchId}`);
        }
        return {
            orderId: row.id,
            companyId: row.companyId,
            branchId: row.branchId,
            accYear: row.accYear.trim(),
        };
    }
}
exports.DocumentNumberLookup = DocumentNumberLookup;
function toSerial(orderNo) {
    if (!/^\d+$/.test(orderNo))
        return null;
    const serial = BigInt(orderNo);
    return serial <= MAX_BIGINT ? serial : null;
}
const MAX_BIGINT = 9223372036854775807n;
//# sourceMappingURL=document-number.lookup.js.map