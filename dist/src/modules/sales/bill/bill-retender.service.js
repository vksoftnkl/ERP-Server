"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillRetenderService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const loyalty_ledger_service_1 = require("../posting/loyalty-ledger.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_posting_service_1 = require("../posting/sales-posting.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_service_1 = require("./bill.service");
const bill_temp_credit_1 = require("./bill-temp-credit");
const bill_api_types_1 = require("./types/bill-api.types");
let BillRetenderService = class BillRetenderService {
    prisma;
    bills;
    salesContext;
    tenders;
    legs;
    loyalty;
    audit;
    constructor(prisma, bills, salesContext, tenders, legs, loyalty, audit) {
        this.prisma = prisma;
        this.bills = bills;
        this.salesContext = salesContext;
        this.tenders = tenders;
        this.legs = legs;
        this.loyalty = loyalty;
        this.audit = audit;
    }
    async retender(dto) {
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            if (bill.sbStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This bill is CANCELLED', posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
            }
            const ctx = await this.salesContext.resolve({ companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL, tx);
            if (!ctx.rights.retender) {
                (0, sales_errors_1.throwSalesRight)('This user may not re-tender on this menu (um_can_retender is false)', posting_types_1.SALES_ERROR_CODES.RIGHT_RETENDER);
            }
            const docDate = (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)();
            if (await (0, sales_guards_1.loadDayClosed)(tx, bill.sbCompanyId, bill.sbBranchId, docDate)) {
                (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed — correct the day book instead`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'sbBillDate');
            }
            const voidIds = [...new Set(dto.voids.map((v) => v.tdId))];
            if (voidIds.length === 0) {
                (0, sales_errors_1.throwSalesRefused)('Nothing to void', posting_types_1.SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH, 'voids');
            }
            const rows = await tx.$queryRaw `
        SELECT t.td_id, t.td_tender_id, t.td_tender_type_id, t.td_tender_ledger_id, t.td_amount, t.td_is_pdc,
               t.td_settle_status, t.td_is_voided, m.tnd_name
          FROM accounts.acc_tender_detail t
          LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = t.td_tender_id
         WHERE t.td_id = ANY(${voidIds}::uuid[]) AND t.td_acc_year = ${bill.sbAccYear}::char(9)
           AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL' AND t.td_src_doc_id = ${bill.sbId}::uuid
           AND t.td_is_deleted = false
         -- Lock the tender rows only: the master is on the nullable side of the
         -- join, and Postgres refuses FOR UPDATE there (0A000).
         FOR UPDATE OF t`;
            if (rows.length !== voidIds.length) {
                (0, sales_errors_1.throwSalesRefused)('One or more tender rows are not on this bill', posting_types_1.SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH, 'voids');
            }
            for (const r of rows) {
                if (r.td_is_voided) {
                    (0, sales_errors_1.throwSalesLocked)(`Tender ${r.td_id} is already voided`, posting_types_1.SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH, 'voids');
                }
                if (r.td_is_pdc &&
                    ['SETTLED', 'PARTIAL'].includes((r.td_settle_status ?? '').toUpperCase())) {
                    (0, sales_errors_1.throwSalesLocked)(`Tender ${r.tnd_name ?? r.td_id} is a cheque that has already moved at the bank — that is a bounce (/cheques), not a re-tender`, posting_types_1.SALES_ERROR_CODES.RETENDER_PDC_MOVED, 'voids');
                }
            }
            const voidedTotal = (0, sales_doc_utils_1.round2)(rows.reduce((t, r) => t + (0, sales_doc_utils_1.num)(r.td_amount), 0));
            const newTotal = (0, sales_doc_utils_1.round2)(dto.tenders.reduce((t, x) => t + (0, sales_doc_utils_1.num)(x.tdAmount), 0));
            if (Math.abs(voidedTotal - newTotal) > 0.01) {
                (0, sales_errors_1.throwSalesRefused)(`The new tenders total ${newTotal.toFixed(2)} against ${voidedTotal.toFixed(2)} voided — a different amount is a part payment or a refund, not a re-tender`, posting_types_1.SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH, 'tenders');
            }
            const actor = ctx.actor;
            const reasonById = new Map(dto.voids.map((v) => [v.tdId, v.reason]));
            for (const r of rows) {
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail
             SET td_is_voided = true, td_void_reason = ${reasonById.get(r.td_id) ?? 'OTHER'},
                 td_voided_on = ${now}, td_voided_by = ${isUuid(actor) ? actor : null}::uuid,
                 td_modified_on = ${now}, td_modified_by = ${actor}
           WHERE td_id = ${r.td_id}::uuid AND td_acc_year = ${bill.sbAccYear}::char(9)`;
                if (r.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.LOYALTY) {
                    await this.loyalty.reverseRedeemForTender(tx, {
                        docId: bill.sbId,
                        accYear: bill.sbAccYear,
                        docType: 'SALE_BILL',
                        docRefno: bill.sbBillRefno,
                        tenderId: r.td_id,
                    }, { reason: `Tender voided: ${reasonById.get(r.td_id) ?? 'OTHER'}`, createdBy: actor });
                }
                if (r.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT) {
                    await tx.accTempCredit.updateMany({
                        where: { atcTenderId: r.td_id, atcTenderAccYear: bill.sbAccYear, atcIsDeleted: false },
                        data: {
                            atcStatus: 'CANCELLED',
                            atcBalanceAmount: 0,
                            atcRemarks: dto.remark,
                            atcModifiedOn: now,
                            atcModifiedBy: actor,
                        },
                    });
                }
            }
            const replaces = rows[0].td_id;
            const scope = this.tenderScope(bill);
            const existing = await this.tenders.getByDocument(tender_detail_api_types_1.TenderSrcModule.SALES, tender_detail_api_types_1.TenderSrcDocType.SALE_BILL, bill.sbId, tx);
            const keep = existing.map((t) => ({ tdId: t.tdId }));
            const created = await this.tenders.syncDocumentTenders(tx, scope, [...keep, ...((0, bill_temp_credit_1.encodeTempCreditTenders)(dto.tenders) ?? [])], actor, bill_api_types_1.BILL_TENDER_AUDIT);
            const newRows = created.filter((t) => !existing.some((e) => e.tdId === t.tdId));
            for (const t of newRows) {
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail SET td_replaces_id = ${replaces}::uuid
           WHERE td_id = ${t.tdId}::uuid AND td_acc_year = ${bill.sbAccYear}::char(9)`;
            }
            if (bill.sbStatus === 'POSTED' && bill.sbCustId) {
                const legs = [];
                for (const t of newRows) {
                    const typeId = Number(t.tdTenderTypeId);
                    if (typeId === sales_doc_utils_1.TENDER_TYPE.CREDIT || typeId === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT) {
                        legs.push({
                            ledgerId: bill.sbCustId,
                            drCr: 'DR',
                            amount: (0, sales_doc_utils_1.num)(t.tdAmount),
                            remarks: `Re-tendered to ${t.tdTenderName ?? 'credit'}`,
                        });
                    }
                    else if (typeId === sales_doc_utils_1.TENDER_TYPE.LOYALTY) {
                        legs.push({
                            role: 'LOYALTY_REDEMPTION',
                            roleTag: 'LOYALTY_REDEMPTION',
                            drCr: 'DR',
                            amount: (0, sales_doc_utils_1.num)(t.tdAmount),
                            field: 'tenders',
                        });
                    }
                    else {
                        legs.push({
                            ledgerId: t.tdTenderLedgerId,
                            drCr: 'DR',
                            amount: (0, sales_doc_utils_1.num)(t.tdAmount),
                            remarks: t.tdTenderName ?? null,
                        });
                    }
                }
                for (const r of rows) {
                    if (r.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.CREDIT ||
                        r.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT) {
                        legs.push({
                            ledgerId: bill.sbCustId,
                            drCr: 'CR',
                            amount: (0, sales_doc_utils_1.num)(r.td_amount),
                            remarks: `Was on ${r.tnd_name ?? 'credit'}`,
                        });
                    }
                    else if (r.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.LOYALTY) {
                        legs.push({
                            role: 'LOYALTY_REDEMPTION',
                            roleTag: 'LOYALTY_REDEMPTION',
                            drCr: 'CR',
                            amount: (0, sales_doc_utils_1.num)(r.td_amount),
                            field: 'tenders',
                        });
                    }
                    else {
                        legs.push({
                            ledgerId: r.td_tender_ledger_id,
                            drCr: 'CR',
                            amount: (0, sales_doc_utils_1.num)(r.td_amount),
                            remarks: r.tnd_name ?? null,
                        });
                    }
                }
                const [prior] = await tx.$queryRaw `
          SELECT COUNT(*) AS n FROM accounts.acc_voucher_header h
           WHERE h.avh_company_id = ${bill.sbCompanyId}::uuid
             AND h.avh_acc_year = ${bill.sbAccYear}::char(9)
             AND h.avh_src_module = 'SALES' AND h.avh_src_doc_type = 'SALE_BILL_RETENDER'
             AND h.avh_is_deleted = false
             AND (h.avh_src_doc_id = ${bill.sbId}::uuid
                  OR h.avh_src_doc_id IN (
                    SELECT t.td_id FROM accounts.acc_tender_detail t
                     WHERE t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
                       AND t.td_src_doc_id = ${bill.sbId}::uuid
                       AND t.td_acc_year = ${bill.sbAccYear}::char(9)))`;
                const round = Number(prior?.n ?? 0) + 1;
                await this.legs.postLegs(tx, {
                    header: {
                        companyId: bill.sbCompanyId,
                        branchId: bill.sbBranchId,
                        tenantId: bill.sbTenantId,
                        accYear: bill.sbAccYear,
                        voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.TENDER_CHANGE,
                        voucherDate: (0, sales_doc_utils_1.isoToday)(),
                        srcModule: 'SALES',
                        srcDocType: 'SALE_BILL_RETENDER',
                        srcDocId: replaces,
                        docRefno: bill.sbBillRefno ? `${bill.sbBillRefno}/RT${round}` : null,
                        docDate: docDate,
                        docAmount: newTotal,
                        partyId: bill.sbCustId,
                        userId: isUuid(bill.sbUserId) ? bill.sbUserId : actor,
                        sessionId: bill.sbSessionId,
                        deviceType: bill.sbDeviceType,
                        remarks: dto.remark,
                        createdBy: actor,
                    },
                    legs,
                });
                const creditTypes = [sales_doc_utils_1.TENDER_TYPE.CREDIT, sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT];
                const settled = (0, sales_doc_utils_1.round2)(created
                    .filter((t) => !t.tdIsDeleted && !voidIds.includes(t.tdId))
                    .filter((t) => !creditTypes.includes(Number(t.tdTenderTypeId)))
                    .reduce((s, t) => s + (0, sales_doc_utils_1.num)(t.tdAmount), 0));
                await tx.$executeRaw `
          UPDATE accounts.acc_bill_balance
             SET abl_alloc_amount = LEAST(abl_bill_amount, ${settled}::numeric), abl_modified_on = ${now}, abl_modified_by = ${actor}
           WHERE abl_src_doc_id = ${bill.sbId}::uuid AND abl_acc_year = ${bill.sbAccYear}::char(9)
             AND abl_src_doc_type = 'SALE_BILL' AND abl_is_deleted = false`;
            }
            const live = await tx.$queryRaw `
        SELECT SUM(td_amount) AS tendered,
               SUM(CASE WHEN td_tender_type_id IN (${sales_doc_utils_1.TENDER_TYPE.CREDIT}, ${sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT}) THEN 0 ELSE td_amount END) AS settled
          FROM accounts.acc_tender_detail
         WHERE td_src_module = 'SALES' AND td_src_doc_type = 'SALE_BILL' AND td_src_doc_id = ${bill.sbId}::uuid
           AND td_acc_year = ${bill.sbAccYear}::char(9) AND td_is_deleted = false AND td_is_voided = false`;
            const paid = (0, sales_doc_utils_1.round2)((0, sales_doc_utils_1.num)(live[0]?.settled) + (0, sales_doc_utils_1.num)(bill.sbAdvanceAmt) + (0, sales_doc_utils_1.num)(bill.sbNoteAdjAmt));
            const balance = (0, sales_doc_utils_1.round2)((0, sales_doc_utils_1.num)(bill.sbBillAmt) - paid);
            await tx.saleBill.update({
                where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
                data: {
                    sbTenderAmt: new client_1.Prisma.Decimal((0, sales_doc_utils_1.num)(live[0]?.tendered).toFixed(2)),
                    sbPaidAmt: new client_1.Prisma.Decimal(paid.toFixed(2)),
                    sbBalanceAmt: new client_1.Prisma.Decimal(balance.toFixed(2)),
                    sbPayStatus: balance <= 0.005 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
                    sbModifiedOn: now,
                    sbModifiedBy: ctx.actorName,
                },
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcDocRefno: bill.sbBillRefno,
                event: 'RETENDERED',
                fromStatus: bill.sbStatus,
                toStatus: bill.sbStatus,
                changedOn: now,
                changedBy: actor,
                remarks: dto.remark,
                deviceId: bill.sbDeviceId,
                sessionId: bill.sbSessionId,
            });
            await this.audit.logEntityChange({
                action: 'update',
                tableName: 'acc_tender_detail',
                screenName: 'Sale Bill',
                screenType: 'transaction',
                pk: bill.sbId,
                displayName: bill.sbBillRefno || bill.sbId,
                originalRecord: {
                    voided: rows.map((r) => ({
                        tdId: r.td_id,
                        amount: (0, sales_doc_utils_1.num)(r.td_amount),
                        tender: r.tnd_name,
                    })),
                },
                modifiedRecord: {
                    tenders: newRows.map((t) => ({
                        tdId: t.tdId,
                        amount: (0, sales_doc_utils_1.num)(t.tdAmount),
                        tender: t.tdTenderName,
                    })),
                },
                userId: actor,
                notes: `Re-tendered: ${dto.remark}`,
            }, tx);
        });
        return this.bills.getById(dto.sbId, dto.sbCompanyId, dto.sbBranchId, dto.sbAccYear);
    }
    tenderScope(bill) {
        return {
            tdSrcModule: tender_detail_api_types_1.TenderSrcModule.SALES,
            tdSrcDocType: tender_detail_api_types_1.TenderSrcDocType.SALE_BILL,
            tdSrcDocId: bill.sbId,
            tdCompanyId: bill.sbCompanyId,
            tdBranchId: bill.sbBranchId,
            tdTenantId: bill.sbTenantId,
            tdAccYear: bill.sbAccYear,
            tdDocDate: bill.sbBillDate,
            tdPartyLedgerId: bill.sbCustId,
            tdUserId: bill.sbUserId,
            tdSessionId: bill.sbSessionId,
            tdDeviceId: bill.sbDeviceId,
            tdDrCr: tender_detail_api_types_1.TenderDrCr.DR,
        };
    }
};
exports.BillRetenderService = BillRetenderService;
exports.BillRetenderService = BillRetenderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bill_service_1.BillService,
        sales_context_service_1.SalesContextService,
        tender_detail_service_1.TenderDetailService,
        sales_posting_service_1.SalesPostingService,
        loyalty_ledger_service_1.LoyaltyLedgerService,
        audit_log_service_1.AuditLogService])
], BillRetenderService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=bill-retender.service.js.map