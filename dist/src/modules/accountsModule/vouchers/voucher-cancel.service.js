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
exports.VoucherCancelService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const doc_register_service_1 = require("../../../common/posting/doc-register.service");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_guards_1 = require("../receipt/receipt.guards");
const receipt_cheque_links_1 = require("../receipt/receipt-cheque-links");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const voucher_billwise_helper_1 = require("./voucher-billwise.helper");
const voucher_books_helper_1 = require("./voucher-books.helper");
const voucher_register_service_1 = require("./voucher-register.service");
const voucher_types_service_1 = require("./voucher-types.service");
const vouchers_errors_1 = require("./vouchers.errors");
const TX = { maxWait: 15_000, timeout: 120_000 };
let VoucherCancelService = class VoucherCancelService {
    prisma;
    requestContext;
    register;
    types;
    posting;
    docRegister;
    recompute;
    constructor(prisma, requestContext, register, types, posting, docRegister, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.register = register;
        this.types = types;
        this.posting = posting;
        this.docRegister = docRegister;
        this.recompute = recompute;
    }
    async cancel(dto) {
        const userId = this.requestContext.getUserId();
        const actor = userId ?? module_service_utils_1.DEFAULT_ACTOR;
        const reason = dto.reason.trim();
        return this.prisma.$transaction(async (tx) => {
            const stored = await this.register.lockHeader(tx, dto.voucherId, dto.accYear);
            if (!stored) {
                (0, vouchers_errors_1.throwMissing)(`No voucher ${dto.voucherId} in ${dto.accYear}`, vouchers_errors_1.VCH.NOT_FOUND);
            }
            this.register.assertScope(stored, dto);
            const type = await this.types.loadTypeById(tx, stored.avh_voucher_type_id);
            if (!type || !type.inRegister) {
                (0, vouchers_errors_1.throwState)('Only a Voucher Register voucher is cancelled here', vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'voucherId');
            }
            const rights = await this.types.rightsFor(tx, userId, type);
            if (!rights.cancel) {
                (0, vouchers_errors_1.throwRight)('This user may not cancel on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_CANCEL);
            }
            if (stored.avh_voucher_status === 'DRAFT') {
                (0, vouchers_errors_1.throwState)(`${dto.voucherId} is a DRAFT — delete it instead`, vouchers_errors_1.VCH.NOT_POSTED);
            }
            if (stored.avh_voucher_status !== 'POSTED' || stored.avh_reversal_voucher_id) {
                (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno ?? dto.voucherId} is already ${stored.avh_voucher_status}`, vouchers_errors_1.VCH.CANCELLED);
            }
            if (stored.avh_against_voucher_id) {
                (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno ?? dto.voucherId} carries a post-dated cheque of ${stored.against_refno ?? 'another voucher'} — cancel that voucher and both are reversed together`, vouchers_errors_1.VCH.NOT_POSTED);
            }
            const pdcVouchers = await tx.accVoucherHeader.findMany({
                where: {
                    ...(0, receipt_cheque_links_1.receiptPdcVoucherWhere)({
                        avhVoucherId: stored.avh_voucher_id,
                        avhVoucherTypeId: stored.avh_voucher_type_id,
                    }),
                    avhVoucherStatus: 'POSTED',
                },
                select: {
                    avhVoucherId: true,
                    avhAccYear: true,
                    avhVoucherRefno: true,
                    avhVoucherDate: true,
                    avhPartyId: true,
                },
            });
            const vouchers = [
                {
                    voucherId: stored.avh_voucher_id,
                    accYear: stored.avh_acc_year,
                    refno: stored.avh_voucher_refno,
                    date: stored.avh_voucher_date,
                },
                ...pdcVouchers.map((v) => ({
                    voucherId: v.avhVoucherId,
                    accYear: v.avhAccYear.trim(),
                    refno: v.avhVoucherRefno,
                    date: v.avhVoucherDate,
                })),
            ];
            const today = new Date().toISOString().slice(0, 10);
            for (const v of vouchers) {
                const [fy] = await tx.$queryRaw `
          SELECT fy_status, fy_lock_date FROM public.fiscal_years
           WHERE comp_id = ${stored.avh_company_id}::uuid AND fy_year_name = ${v.accYear}::char(9)
             AND is_deleted = false LIMIT 1`;
                if (fy && fy.fy_status.trim().toUpperCase() !== 'OPEN') {
                    (0, vouchers_errors_1.throwRefused)(`Accounting year ${v.accYear} is ${fy.fy_status.trim()}`, vouchers_errors_1.VCH.YEAR_CLOSED, 'accYear');
                }
                const lock = fy?.fy_lock_date ? fy.fy_lock_date.toISOString().slice(0, 10) : null;
                const voucherDate = v.date.toISOString().slice(0, 10);
                if (lock && (today <= lock || voucherDate <= lock)) {
                    (0, vouchers_errors_1.throwRefused)(`${v.accYear} is locked up to ${lock}`, vouchers_errors_1.VCH.PERIOD_LOCKED, 'voucherId');
                }
                await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, v.accYear, 'accYear');
            }
            const elsewhere = (await Promise.all(vouchers.map((v) => (0, voucher_billwise_helper_1.otherVoucherOnRaisedBills)(tx, v.voucherId, v.accYear)))).flat();
            if (elsewhere.length > 0) {
                const who = elsewhere
                    .map((e) => `${e.voucherRefno ?? 'another voucher'} (bill ${e.billRefno})`)
                    .join(', ');
                (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno} raised a bill that ${who} has already settled against — release that allocation first`, vouchers_errors_1.VCH.ALLOCATED_ELSEWHERE);
            }
            const chequeFilter = await (0, receipt_cheque_links_1.receiptChequeFilter)(tx, {
                receiptVoucherId: stored.avh_voucher_id,
                voucherIds: vouchers.map((v) => v.voucherId),
            });
            const moved = await tx.accPdcRegister.findMany({
                where: { ...chequeFilter, apdIsDeleted: false, apdStatus: { not: 'HELD' } },
                select: { apdInstrumentNo: true, apdStatus: true, apdTraType: true },
            });
            if (moved.length > 0) {
                const screen = moved[0].apdTraType.trim() === 'P'
                    ? 'Issued Cheques screen (menu 52)'
                    : 'Received Cheques screen (menu 51)';
                (0, vouchers_errors_1.throwState)(`Cheque ${moved[0].apdInstrumentNo} is ${moved[0].apdStatus}. Once an instrument has left the drawer the voucher behind it cannot be unmade — unwind it on the ${screen} first`, vouchers_errors_1.VCH.CHEQUE_MOVED);
            }
            const tdsRows = await tx.$queryRaw `
        SELECT t.atd_id, t.atd_challan_no, t.atd_base_amount, t.atd_tax_amount
          FROM accounts.acc_tds_register t
         WHERE t.atd_voucher_id = ${stored.avh_voucher_id}::uuid
           AND t.atd_voucher_acc_year = ${stored.avh_acc_year}::char(9)
           AND t.atd_is_deleted = false AND t.atd_reversal_of_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                            WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`;
            const deposited = tdsRows.find((r) => r.atd_challan_no);
            if (deposited) {
                (0, vouchers_errors_1.throwState)(`The TDS on ${stored.avh_voucher_refno} was deposited under challan ${deposited.atd_challan_no} — correct it with a 26Q revision, not a cancel`, vouchers_errors_1.VCH.TDS_DEPOSITED);
            }
            const gdrId = await this.docRegister.registerIdOfVoucher(tx, stored.avh_voucher_id, stored.avh_acc_year);
            if (gdrId) {
                const [irn] = await tx.$queryRaw `
          SELECT gde_irn, gde_status::text AS gde_status FROM accounts.acc_voucher_doc_einvoice
           WHERE gde_gdr_id = ${gdrId}::uuid AND gde_acc_year = ${stored.avh_acc_year}::char(9)
           LIMIT 1`;
                if (irn?.gde_irn &&
                    !['CANCELLED', 'CANCELED', 'NA'].includes(irn.gde_status.toUpperCase())) {
                    (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno} carries IRN ${irn.gde_irn} — cancel it on the e-invoice screen first`, vouchers_errors_1.VCH.IRN_LIVE);
                }
            }
            const now = new Date();
            const touched = [];
            let allocationsReversed = 0;
            const mirrors = [];
            for (const v of vouchers) {
                const mirror = await this.posting.reverseLegs(tx, v.voucherId, v.accYear, reason, actor);
                if (!mirror) {
                    (0, vouchers_errors_1.throwState)(`${v.refno ?? v.voucherId} is already reversed`, vouchers_errors_1.VCH.CANCELLED);
                }
                await tx.$executeRaw `
          UPDATE accounts.acc_voucher_header
             SET avh_status_by = ${actor}::uuid
           WHERE avh_voucher_id = ${v.voucherId}::uuid AND avh_acc_year = ${v.accYear}::char(9)`;
                mirrors.push({ of: v.voucherId, accYear: v.accYear, mirrorId: mirror.voucherId });
                const reversed = await (0, voucher_billwise_helper_1.reverseVoucherAllocations)(tx, {
                    voucherId: v.voucherId,
                    accYear: v.accYear,
                    reversalVoucherId: mirror.voucherId,
                    reason,
                    actor,
                    now,
                });
                allocationsReversed += reversed.count;
                touched.push(...reversed.touched);
            }
            if (touched.length > 0) {
                await this.recompute.recomputeBills(tx, touched, now);
            }
            let closed = 0;
            for (const v of vouchers) {
                closed += await tx.$executeRaw `
          UPDATE accounts.acc_bill_balance
             SET abl_is_deleted = true, abl_is_active = false,
                 abl_modified_on = ${now}, abl_modified_by = ${actor}
           WHERE abl_voucher_id = ${v.voucherId}::uuid AND abl_acc_year = ${v.accYear}::char(9)
             AND abl_is_deleted = false`;
            }
            const held = await tx.accPdcRegister.findMany({
                where: { ...chequeFilter, apdIsDeleted: false, apdStatus: 'HELD' },
                select: { apdId: true, apdAccYear: true },
            });
            for (const c of held) {
                await tx.accPdcRegister.update({
                    where: { apdId_apdAccYear: { apdId: c.apdId, apdAccYear: c.apdAccYear } },
                    data: {
                        apdStatus: 'CANCELLED',
                        apdCancelReason: reason.slice(0, 250),
                        apdCancelDate: now,
                        apdStatusOn: now,
                        apdStatusBy: actor,
                        apdModifiedOn: now,
                        apdModifiedBy: actor,
                    },
                });
            }
            await tx.accTenderDetail.updateMany({
                where: { tdSrcDocId: stored.avh_voucher_id, tdIsDeleted: false },
                data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
            });
            let gstDocCancelled = false;
            if (gdrId) {
                gstDocCancelled =
                    (await this.docRegister.cancel(tx, gdrId, stored.avh_acc_year, reason, actor)) > 0;
            }
            const todayMirror = mirrors[0].mirrorId;
            for (const t of tdsRows) {
                await tx.$executeRaw `
          INSERT INTO accounts.acc_tds_register (
            atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
            atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
            atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
            atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_reversal_of_id,
            atd_remarks, atd_created_by
          )
          SELECT o.atd_company_id, o.atd_branch_id, o.atd_tenant_id, o.atd_acc_year, o.atd_quarter, o.atd_direction,
                 o.atd_party_id, o.atd_pan, o.atd_party_name, o.atd_deductee_type, o.atd_section, o.atd_rate,
                 o.atd_rate_source, o.atd_base_amount, -o.atd_tax_amount,
                 ${todayMirror}::uuid, o.atd_voucher_acc_year,
                 o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
                 ${`Reversal of ${stored.avh_voucher_refno ?? ''}: ${reason}`.slice(0, 250)}, ${actor}
            FROM accounts.acc_tds_register o WHERE o.atd_id = ${t.atd_id}::uuid`;
            }
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: stored.avh_company_id,
                branchId: stored.avh_branch_id,
                tenantId: stored.avh_tenant_id,
                accYear: stored.avh_acc_year,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: (0, voucher_register_service_1.statusDocType)(type),
                srcDocId: stored.avh_voucher_id,
                srcDocRefno: stored.avh_voucher_refno,
                event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                fromStatus: 'POSTED',
                toStatus: 'CANCELLED',
                changedBy: actor,
                deviceId: this.requestContext.getDeviceId(),
                changedOn: now,
                remarks: reason,
            });
            const ledgers = await tx.$queryRaw `
        SELECT DISTINCT av_ledger_id AS id FROM accounts.acc_vouchers
         WHERE (av_voucher_id, av_acc_year) IN (${client_1.Prisma.join(vouchers.map((v) => client_1.Prisma.sql `(${v.voucherId}::uuid, ${v.accYear}::char(9))`))})`;
            await (0, voucher_books_helper_1.assertVoucherBooksReconcile)(tx, {
                companyId: stored.avh_company_id,
                accYear: stored.avh_acc_year,
                ledgerIds: [stored.avh_party_id, ...ledgers.map((l) => l.id)],
            });
            const [rev] = await tx.$queryRaw `
        SELECT avh_voucher_refno FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${todayMirror}::uuid AND avh_acc_year = ${stored.avh_acc_year}::char(9)`;
            return {
                voucherId: stored.avh_voucher_id,
                accYear: stored.avh_acc_year,
                voucherRefno: stored.avh_voucher_refno,
                reversalVoucherId: todayMirror,
                reversalRefno: rev?.avh_voucher_refno ?? null,
                cancelledOn: now.toISOString(),
                billsClosed: closed,
                allocationsReversed,
                gstDocCancelled,
                tdsReversed: tdsRows.length,
                chequesCancelled: held.length,
                pdcVouchersReversed: pdcVouchers.length,
            };
        }, TX);
    }
};
exports.VoucherCancelService = VoucherCancelService;
exports.VoucherCancelService = VoucherCancelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        voucher_register_service_1.VoucherRegisterService,
        voucher_types_service_1.VoucherTypesService,
        voucher_posting_service_1.VoucherPostingService,
        doc_register_service_1.DocRegisterService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], VoucherCancelService);
//# sourceMappingURL=voucher-cancel.service.js.map