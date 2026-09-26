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
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const doc_register_service_1 = require("../../../common/posting/doc-register.service");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_guards_1 = require("../receipt/receipt.guards");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const voucher_billwise_helper_1 = require("./voucher-billwise.helper");
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
            const today = new Date().toISOString().slice(0, 10);
            const [fy] = await tx.$queryRaw `
        SELECT fy_status, fy_lock_date FROM public.fiscal_years
         WHERE comp_id = ${stored.avh_company_id}::uuid AND fy_year_name = ${stored.avh_acc_year}::char(9)
           AND is_deleted = false LIMIT 1`;
            if (fy && fy.fy_status.trim().toUpperCase() !== 'OPEN') {
                (0, vouchers_errors_1.throwRefused)(`Accounting year ${stored.avh_acc_year} is ${fy.fy_status.trim()}`, vouchers_errors_1.VCH.YEAR_CLOSED, 'accYear');
            }
            const lock = fy?.fy_lock_date ? fy.fy_lock_date.toISOString().slice(0, 10) : null;
            const voucherDate = stored.avh_voucher_date.toISOString().slice(0, 10);
            if (lock && (today <= lock || voucherDate <= lock)) {
                (0, vouchers_errors_1.throwRefused)(`${stored.avh_acc_year} is locked up to ${lock}`, vouchers_errors_1.VCH.PERIOD_LOCKED, 'voucherId');
            }
            await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, stored.avh_acc_year, 'accYear');
            const elsewhere = await (0, voucher_billwise_helper_1.otherVoucherOnRaisedBills)(tx, stored.avh_voucher_id, stored.avh_acc_year);
            if (elsewhere.length > 0) {
                const who = elsewhere
                    .map((e) => `${e.voucherRefno ?? 'another voucher'} (bill ${e.billRefno})`)
                    .join(', ');
                (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno} raised a bill that ${who} has already settled against — release that allocation first`, vouchers_errors_1.VCH.ALLOCATED_ELSEWHERE);
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
            const mirror = await this.posting.reverseLegs(tx, stored.avh_voucher_id, stored.avh_acc_year, reason, actor);
            if (!mirror) {
                (0, vouchers_errors_1.throwState)(`${stored.avh_voucher_refno} is already reversed`, vouchers_errors_1.VCH.CANCELLED);
            }
            await tx.$executeRaw `
        UPDATE accounts.acc_voucher_header
           SET avh_status_by = ${actor}::uuid
         WHERE avh_voucher_id = ${stored.avh_voucher_id}::uuid AND avh_acc_year = ${stored.avh_acc_year}::char(9)`;
            const reversed = await (0, voucher_billwise_helper_1.reverseVoucherAllocations)(tx, {
                voucherId: stored.avh_voucher_id,
                accYear: stored.avh_acc_year,
                reversalVoucherId: mirror.voucherId,
                reason,
                actor,
                now,
            });
            if (reversed.touched.length > 0) {
                await this.recompute.recomputeBills(tx, reversed.touched, now);
            }
            const closed = await tx.$executeRaw `
        UPDATE accounts.acc_bill_balance
           SET abl_is_deleted = true, abl_is_active = false,
               abl_modified_on = ${now}, abl_modified_by = ${actor}
         WHERE abl_voucher_id = ${stored.avh_voucher_id}::uuid AND abl_acc_year = ${stored.avh_acc_year}::char(9)
           AND abl_is_deleted = false`;
            let gstDocCancelled = false;
            if (gdrId) {
                gstDocCancelled =
                    (await this.docRegister.cancel(tx, gdrId, stored.avh_acc_year, reason, actor)) > 0;
            }
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
                 ${mirror.voucherId}::uuid, o.atd_voucher_acc_year,
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
                changedOn: now,
                remarks: reason,
            });
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: stored.avh_company_id,
                accYear: stored.avh_acc_year,
                ledgerIds: [stored.avh_party_id],
                vouchers: [
                    { voucherId: stored.avh_voucher_id, accYear: stored.avh_acc_year },
                    { voucherId: mirror.voucherId, accYear: stored.avh_acc_year },
                ],
            });
            const [rev] = await tx.$queryRaw `
        SELECT avh_voucher_refno FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${mirror.voucherId}::uuid AND avh_acc_year = ${stored.avh_acc_year}::char(9)`;
            return {
                voucherId: stored.avh_voucher_id,
                accYear: stored.avh_acc_year,
                voucherRefno: stored.avh_voucher_refno,
                reversalVoucherId: mirror.voucherId,
                reversalRefno: rev?.avh_voucher_refno ?? null,
                cancelledOn: now.toISOString(),
                billsClosed: closed,
                allocationsReversed: reversed.count,
                gstDocCancelled,
                tdsReversed: tdsRows.length,
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