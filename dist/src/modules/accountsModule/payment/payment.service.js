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
exports.sum = exports.money = exports.ZERO = exports.PaymentService = exports.statusOf = exports.STORED_HEADER_SELECT = void 0;
exports.toOtherLinePayload = toOtherLinePayload;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const tender_detail_service_1 = require("../tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../tenderDetail/types/tender-detail-api.types");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_service_1 = require("../receipt/receipt.service");
Object.defineProperty(exports, "STORED_HEADER_SELECT", { enumerable: true, get: function () { return receipt_service_1.STORED_HEADER_SELECT; } });
Object.defineProperty(exports, "statusOf", { enumerable: true, get: function () { return receipt_service_1.statusOf; } });
const receipt_utils_1 = require("../receipt/receipt.utils");
Object.defineProperty(exports, "money", { enumerable: true, get: function () { return receipt_utils_1.money; } });
Object.defineProperty(exports, "sum", { enumerable: true, get: function () { return receipt_utils_1.sum; } });
Object.defineProperty(exports, "ZERO", { enumerable: true, get: function () { return receipt_utils_1.ZERO; } });
const payment_open_items_service_1 = require("./payment-open-items.service");
const payment_draft_lines_1 = require("./payment-draft-lines");
const payment_ledger_roles_1 = require("./payment-ledger-roles");
const payment_cheque_links_1 = require("./payment-cheque-links");
const cheque_book_helper_1 = require("../vouchers/cheque-book.helper");
const payment_lines_1 = require("./payment-lines");
const payment_tds_1 = require("./payment-tds");
const payment_guards_1 = require("./payment.guards");
const payment_enum_1 = require("./types/payment-enum");
const PAYMENT_ROLES = Object.values(payment_enum_1.PaymentLedgerRole);
const PAYMENT_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
let PaymentService = class PaymentService {
    prisma;
    requestContext;
    tenderDetailService;
    openItemsService;
    constructor(prisma, requestContext, tenderDetailService, openItemsService) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.tenderDetailService = tenderDetailService;
        this.openItemsService = openItemsService;
    }
    async save(dto) {
        const actor = (0, module_service_utils_1.resolveActor)(dto.avhUserId, this.requestContext.getUserId()) ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction((tx) => this.saveInTransaction(tx, dto, actor), PAYMENT_TRANSACTION_OPTIONS);
    }
    async saveInTransaction(tx, dto, actor) {
        const paymentDate = (0, receipt_utils_1.toDateOnly)(dto.avhVoucherDate);
        const replace = dto.replace ?? true;
        const derivedYear = (0, payment_guards_1.accYearOf)(paymentDate);
        if (derivedYear !== dto.avhAccYear) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'avhVoucherDate',
                    message: `${dto.avhVoucherDate} falls in ${derivedYear}, but the payment says ${dto.avhAccYear}`,
                },
            ]);
        }
        await (0, payment_guards_1.assertAccYearWritable)(tx, dto.avhCompanyId, dto.avhAccYear, 'avhAccYear');
        const partyId = dto.avhPartyId;
        const [party, voucherType, settings] = await Promise.all([
            (0, payment_guards_1.loadPayee)(tx, dto.avhCompanyId, partyId, 'avhPartyId'),
            (0, payment_guards_1.loadPaymentVoucherType)(tx),
            this.openItemsService.loadSettings(dto.avhCompanyId, dto.avhBranchId),
        ]);
        const existing = dto.avhVoucherId
            ? await tx.accVoucherHeader.findUnique({
                where: {
                    avhVoucherId_avhAccYear: { avhVoucherId: dto.avhVoucherId, avhAccYear: dto.avhAccYear },
                },
                select: {
                    avhVoucherId: true,
                    avhVoucherStatus: true,
                    avhIsDeleted: true,
                    avhVoucherRefno: true,
                    avhDraftLines: true,
                    avhVoucherTypeId: true,
                    avhCompanyId: true,
                    avhBranchId: true,
                },
            })
            : null;
        if (dto.avhVoucherId &&
            (!existing ||
                existing.avhVoucherTypeId !== voucherType.vchrTypeId ||
                existing.avhCompanyId !== dto.avhCompanyId ||
                existing.avhBranchId !== dto.avhBranchId)) {
            (0, module_service_utils_1.throwAccountsNotFound)('Payment not found', 'avhVoucherId', `No payment ${dto.avhVoucherId} in ${dto.avhAccYear}`);
        }
        if (existing && (existing.avhIsDeleted || !this.isEditableStatus(existing.avhVoucherStatus))) {
            (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be edited', [
                {
                    field: 'avhVoucherId',
                    message: `${existing.avhVoucherRefno ?? dto.avhVoucherId} is ${existing.avhVoucherStatus}. ` +
                        'Only a DRAFT may be edited here; use /payments/update-header for narration, or ' +
                        'cancel and re-enter to change the money.',
                },
            ]);
        }
        const tenders = await (0, payment_lines_1.normalisePaymentTenders)(tx, {
            tenders: dto.tenders,
            companyId: dto.avhCompanyId,
            branchId: dto.avhBranchId,
            paymentDate,
            partyName: party.ledName,
        });
        await this.assertInstrumentYearsWritable(tx, dto.avhCompanyId, tenders);
        const roleLedgers = await (0, payment_ledger_roles_1.describePaymentRoleLedgers)(tx, PAYMENT_ROLES, {
            companyId: dto.avhCompanyId,
            branchId: dto.avhBranchId,
        });
        const tdsFacts = await (0, payment_tds_1.loadPaymentTdsFacts)(tx, {
            companyId: dto.avhCompanyId,
            party,
            accYear: dto.avhAccYear,
            date: dto.avhVoucherDate,
        });
        const { lines } = await (0, payment_lines_1.normalisePaymentOtherLines)(tx, {
            lines: dto.otherLines ?? [],
            tenders,
            companyId: dto.avhCompanyId,
            branchId: dto.avhBranchId,
            party,
            partyId,
            settings,
            tds: tdsFacts,
            ledgerForRole: (role) => {
                const resolved = (0, payment_ledger_roles_1.ledgerForRole)(roleLedgers, role);
                return resolved ? { ledgerId: resolved.ledgerId, ledgerName: resolved.ledgerName } : null;
            },
        });
        this.assertSalesman(dto.avhEmployeeId, settings);
        const docAmount = (0, receipt_utils_1.sum)(tenders.map((tender) => tender.amount));
        const header = await this.upsertDraftHeader(tx, {
            dto,
            existingId: existing?.avhVoucherId ?? null,
            voucherTypeId: voucherType.vchrTypeId,
            partyId,
            paymentDate,
            docAmount,
            draftLines: lines,
            cheques: chequeDetailByRow(tenders),
            beneficiaries: beneficiaryByRow(tenders),
            allocations: rememberedAllocations(dto, existing?.avhDraftLines),
            creditsApplied: rememberedCredits(dto, existing?.avhDraftLines),
            actor,
        });
        await this.syncTenders(tx, {
            dto,
            voucherId: header.avhVoucherId,
            partyId,
            paymentDate,
            tenders,
            actor,
            replace,
        });
        if (!existing) {
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                tenantId: dto.avhTenantId ?? null,
                accYear: dto.avhAccYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.PAYMENT,
                srcDocId: header.avhVoucherId,
                event: txn_status_log_helper_1.TxnStatusEvent.CREATED,
                toStatus: payment_enum_1.VoucherStatus.DRAFT,
                changedBy: actor,
                deviceId: dto.avhDeviceId ?? null,
                sessionId: dto.avhSessionId ?? null,
            });
        }
        const stored = await this.loadHeaderOrThrow(tx, header.avhVoucherId, dto.avhAccYear);
        return {
            header: await this.toHeaderPayload(tx, stored),
            tenders: await this.loadTenderPayload(tx, header.avhVoucherId),
            otherLines: lines.map(toOtherLinePayload),
            expectedRoles: [],
        };
    }
    async get(query) {
        const header = await this.loadHeaderOrThrow(this.prisma, query.avhVoucherId, query.avhAccYear);
        (0, payment_guards_1.assertHeaderScope)(header, {
            companyId: query.avhCompanyId,
            branchId: query.avhBranchId,
            accYear: query.avhAccYear,
            voucherId: query.avhVoucherId,
        });
        return this.loadFullPayment(this.prisma, header);
    }
    async loadFullPayment(client, header) {
        const pdcHeaders = await client.accVoucherHeader.findMany({
            where: (0, payment_cheque_links_1.paymentPdcVoucherWhere)(header),
            select: receipt_service_1.STORED_HEADER_SELECT,
            orderBy: { avhVoucherDate: 'asc' },
        });
        const voucherIds = [header.avhVoucherId, ...pdcHeaders.map((row) => row.avhVoucherId)];
        const years = [...new Set([header.avhAccYear, ...pdcHeaders.map((row) => row.avhAccYear)])];
        const tenderRows = await client.accTenderDetail.findMany({
            where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
            select: { tdId: true, tdRowNo: true },
        });
        const chequeFilter = await (0, payment_cheque_links_1.paymentChequeFilter)(client, {
            receiptVoucherId: header.avhVoucherId,
            voucherIds,
        });
        const [legs, adjustments, cheques, advanceBills] = await Promise.all([
            client.accVoucher.findMany({
                where: { avVoucherId: { in: voucherIds }, avAccYear: { in: years }, avIsDeleted: false },
                select: {
                    avId: true,
                    avVoucherId: true,
                    avRowNo: true,
                    avDrCr: true,
                    avLedgerId: true,
                    avAmount: true,
                    avRole: true,
                    avRemarks: true,
                    ledger: { select: { ledName: true } },
                },
                orderBy: [{ avVoucherId: 'asc' }, { avRowNo: 'asc' }],
            }),
            client.accBillAdjustment.findMany({
                where: {
                    abjVoucherId: { in: voucherIds },
                    abjVoucherAccYear: { in: years },
                    abjIsDeleted: false,
                },
                select: {
                    abjId: true,
                    abjBillId: true,
                    abjBillAccYear: true,
                    abjAdjType: true,
                    abjSettlementMode: true,
                    abjDrCr: true,
                    abjAmount: true,
                    abjAdjDate: true,
                    abjIsPostDated: true,
                    abjVoucherId: true,
                    abjChequeId: true,
                    abjAgainstBillId: true,
                    abjApprovedBy: true,
                    abjRemarks: true,
                    abjReversalOfId: true,
                    bill: {
                        select: {
                            ablDocRefno: true,
                            ablDocDate: true,
                            ablBillType: true,
                            ablBillAmount: true,
                            ablPendingAmount: true,
                            ablDueDate: true,
                            ablStatus: true,
                        },
                    },
                    againstBill: { select: { ablDocRefno: true } },
                },
                orderBy: [{ abjAdjDate: 'asc' }, { abjRowNo: 'asc' }],
            }),
            client.$queryRaw `
        SELECT p.apd_id, p.apd_acc_year, p.apd_instrument_type, p.apd_instrument_no, p.apd_instrument_date,
               p.apd_amount, p.apd_bank_name, p.apd_bank_ledger_id, p.apd_cheque_book_id, b.acb_book_no,
               p.apd_favouring, p.apd_ac_payee, p.apd_printed_on, p.apd_print_count, p.apd_status,
               p.apd_voucher_id, p.apd_tender_id
          FROM accounts.acc_pdc_register p
          LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
         WHERE p.apd_is_deleted = false
           AND (p.apd_voucher_id = ANY(${voucherIds}::uuid[])
                OR p.apd_tender_id = ANY(${tenderRows.map((row) => row.tdId)}::uuid[]))
         ORDER BY p.apd_instrument_date, p.apd_instrument_no`,
            client.accBillBalance.findMany({
                where: {
                    ablVoucherId: { in: voucherIds },
                    ablAccYear: { in: years },
                    ablBillType: 'ADVANCE',
                    ablIsDeleted: false,
                },
                select: {
                    ablId: true,
                    ablAccYear: true,
                    ablDocRefno: true,
                    ablDocDate: true,
                    ablBillAmount: true,
                    ablPendingAmount: true,
                    ablVoucherId: true,
                },
            }),
        ]);
        void chequeFilter;
        const reversedIds = new Set(adjustments.length === 0
            ? []
            : (await client.accBillAdjustment.findMany({
                where: {
                    abjReversalOfId: { in: adjustments.map((row) => row.abjId) },
                    abjIsDeleted: false,
                },
                select: { abjReversalOfId: true },
            })).map((row) => row.abjReversalOfId));
        const today = (0, receipt_utils_1.todayUtc)();
        const legsFor = (voucherId) => legs
            .filter((leg) => leg.avVoucherId === voucherId)
            .map((leg) => ({
            avId: leg.avId,
            avRowNo: leg.avRowNo,
            avDrCr: leg.avDrCr,
            avLedgerId: leg.avLedgerId,
            avLedgerName: leg.ledger?.ledName ?? null,
            avAmount: (0, receipt_utils_1.toAmount)(leg.avAmount),
            avRole: leg.avRole,
            avRemarks: leg.avRemarks,
        }));
        const toAllocation = (row) => ({
            abjId: row.abjId,
            billId: row.abjBillId,
            billAccYear: row.abjBillAccYear,
            docRefno: row.bill?.ablDocRefno ?? '',
            docDate: (0, receipt_utils_1.toDateString)(row.bill?.ablDocDate ?? null) ?? '',
            billType: row.bill?.ablBillType ?? null,
            billAmount: row.bill ? (0, receipt_utils_1.toAmount)(row.bill.ablBillAmount) : null,
            pendingAmount: row.bill ? (0, receipt_utils_1.toAmount)(row.bill.ablPendingAmount) : null,
            dueDate: (0, receipt_utils_1.toDateString)(row.bill?.ablDueDate ?? null),
            status: row.bill?.ablStatus ?? null,
            adjType: row.abjAdjType,
            settlementMode: row.abjSettlementMode,
            drCr: row.abjDrCr,
            amount: (0, receipt_utils_1.toAmount)(row.abjAmount),
            adjDate: (0, receipt_utils_1.toDateString)(row.abjAdjDate),
            isPostDated: row.abjIsPostDated,
            matured: !row.abjIsPostDated || row.abjAdjDate <= today,
            voucherId: row.abjVoucherId,
            chequeId: row.abjChequeId,
            againstBillId: row.abjAgainstBillId,
            againstBillRefno: row.againstBill?.ablDocRefno ?? null,
            reversalOfId: row.abjReversalOfId,
            isReversed: reversedIds.has(row.abjId),
            approvedBy: row.abjApprovedBy,
            remarks: row.abjRemarks,
        });
        const rowNoByTenderId = new Map(tenderRows.map((row) => [row.tdId, row.tdRowNo]));
        const draft = (0, payment_draft_lines_1.rehydratePaymentDraft)(header.avhDraftLines);
        const remembered = (0, receipt_service_1.statusOf)(header) === payment_enum_1.VoucherStatus.DRAFT
            ? await this.rememberedSettlement(client, header, draft)
            : null;
        return {
            header: await this.toHeaderPayload(client, header),
            tenders: await this.loadTenderPayload(client, header.avhVoucherId),
            otherLines: draft.otherLines,
            legs: legsFor(header.avhVoucherId),
            allocations: remembered?.allocations ??
                adjustments.filter((row) => row.abjAgainstBillId === null).map(toAllocation),
            creditsApplied: remembered?.creditsApplied ??
                adjustments.filter((row) => row.abjAgainstBillId !== null).map(toAllocation),
            chequesIssued: cheques.map((cheque) => ({
                pdcId: cheque.apd_id,
                accYear: cheque.apd_acc_year.trim(),
                tenderRowNo: cheque.apd_tender_id
                    ? (rowNoByTenderId.get(cheque.apd_tender_id) ?? null)
                    : null,
                instrumentType: cheque.apd_instrument_type,
                instrumentNo: cheque.apd_instrument_no,
                instrumentDate: (0, receipt_utils_1.toDateString)(cheque.apd_instrument_date),
                amount: (0, receipt_utils_1.toAmount)(cheque.apd_amount),
                bankName: cheque.apd_bank_name,
                bankLedgerId: cheque.apd_bank_ledger_id,
                chequeBookId: cheque.apd_cheque_book_id,
                bookNo: cheque.acb_book_no,
                favouring: cheque.apd_favouring,
                acPayee: cheque.apd_ac_payee ?? true,
                printed: cheque.apd_printed_on !== null,
                printCount: cheque.apd_print_count ?? 0,
                status: cheque.apd_status,
                voucherId: cheque.apd_voucher_id,
            })),
            pdcVouchers: pdcHeaders.map((pdc) => ({
                voucherId: pdc.avhVoucherId,
                accYear: pdc.avhAccYear,
                voucherRefno: pdc.avhVoucherRefno,
                voucherDate: (0, receipt_utils_1.toDateString)(pdc.avhVoucherDate),
                docAmount: (0, receipt_utils_1.toAmount)(pdc.avhDocAmount),
                adjustAmount: (0, receipt_utils_1.toAmount)(pdc.avhAdjustAmount),
                status: pdc.avhVoucherStatus,
                legs: legsFor(pdc.avhVoucherId),
            })),
            advanceBills: advanceBills.map((bill) => ({
                billId: bill.ablId,
                billAccYear: bill.ablAccYear,
                docRefno: bill.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(bill.ablDocDate),
                billAmount: (0, receipt_utils_1.toAmount)(bill.ablBillAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(bill.ablPendingAmount),
                voucherId: bill.ablVoucherId,
            })),
        };
    }
    async rememberedSettlement(client, header, draft) {
        if (draft.allocations.length === 0 && draft.creditsApplied.length === 0) {
            return null;
        }
        const keys = [...draft.allocations, ...draft.creditsApplied];
        const bills = await client.accBillBalance.findMany({
            where: { OR: keys.map((row) => ({ ablId: row.billId, ablAccYear: row.billAccYear })) },
            select: {
                ablId: true,
                ablAccYear: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablBillType: true,
                ablBillAmount: true,
                ablPendingAmount: true,
                ablDueDate: true,
                ablStatus: true,
            },
        });
        const billByKey = new Map(bills.map((bill) => [`${bill.ablId}|${bill.ablAccYear}`, bill]));
        const adjDate = (0, receipt_utils_1.toDateString)(header.avhVoucherDate);
        const base = (row) => {
            const bill = billByKey.get(`${row.billId}|${row.billAccYear}`);
            return {
                abjId: null,
                billId: row.billId,
                billAccYear: row.billAccYear,
                docRefno: bill?.ablDocRefno ?? '',
                docDate: (0, receipt_utils_1.toDateString)(bill?.ablDocDate),
                billType: bill?.ablBillType ?? null,
                billAmount: bill ? (0, receipt_utils_1.toAmount)(bill.ablBillAmount) : null,
                pendingAmount: bill ? (0, receipt_utils_1.toAmount)(bill.ablPendingAmount) : null,
                dueDate: (0, receipt_utils_1.toDateString)(bill?.ablDueDate),
                status: bill?.ablStatus ?? null,
                drCr: payment_enum_1.DrCr.DR,
                adjDate,
                isPostDated: false,
                matured: true,
                voucherId: null,
                chequeId: null,
                againstBillId: null,
                againstBillRefno: null,
                reversalOfId: null,
                isReversed: false,
                remarks: null,
            };
        };
        const allocations = [];
        for (const row of draft.allocations) {
            allocations.push({
                ...base(row),
                adjType: payment_enum_1.BillAdjType.ALLOCATION,
                settlementMode: null,
                amount: row.amount,
                approvedBy: null,
            });
            if (row.discount > 0) {
                allocations.push({
                    ...base(row),
                    adjType: payment_enum_1.BillAdjType.DISCOUNT,
                    settlementMode: payment_enum_1.BillSettlementMode.DISCOUNT,
                    amount: row.discount,
                    approvedBy: null,
                });
            }
            if (row.writeoff > 0) {
                allocations.push({
                    ...base(row),
                    adjType: payment_enum_1.BillAdjType.WRITEOFF,
                    settlementMode: payment_enum_1.BillSettlementMode.WRITEOFF,
                    amount: row.writeoff,
                    approvedBy: row.writeoffApprovedBy,
                });
            }
            if (row.roundoff > 0) {
                allocations.push({
                    ...base(row),
                    adjType: payment_enum_1.BillAdjType.ROUND_OFF,
                    settlementMode: payment_enum_1.BillSettlementMode.ROUND_OFF,
                    amount: row.roundoff,
                    approvedBy: null,
                });
            }
        }
        const creditsApplied = draft.creditsApplied.map((row) => {
            const bill = billByKey.get(`${row.billId}|${row.billAccYear}`);
            const routing = bill ? (0, payment_enum_1.debitRouting)(bill.ablBillType) : null;
            return {
                ...base(row),
                adjType: routing?.adjType ?? payment_enum_1.BillAdjType.ADVANCE_ADJUST,
                settlementMode: routing?.settlementMode ?? null,
                amount: row.amount,
                approvedBy: null,
            };
        });
        return { allocations, creditsApplied };
    }
    async updateHeader(dto, body) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const allowed = new Set([
            'avhVoucherId',
            'avhCompanyId',
            'avhBranchId',
            'avhAccYear',
            'avhRemarks',
            'avhUsrRefno',
            'avhDocRefno',
            'avhDocDate',
            'avhEmployeeId',
            'editRemark',
        ]);
        const rejected = Object.keys(body).filter((key) => !allowed.has(key));
        if (rejected.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Only the header may be edited', [
                {
                    field: rejected[0],
                    message: `${rejected.join(', ')} cannot be changed on a posted payment. Money is changed by ` +
                        'cancelling and re-entering (R3).',
                },
            ]);
        }
        return this.prisma.$transaction(async (tx) => {
            const header = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
            (0, payment_guards_1.assertHeaderScope)(header, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                accYear: dto.avhAccYear,
                voucherId: dto.avhVoucherId,
            });
            if ((0, receipt_service_1.statusOf)(header) === payment_enum_1.VoucherStatus.CANCELLED) {
                (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be edited', [
                    { field: 'avhVoucherId', message: 'A cancelled payment is closed to edits' },
                ]);
            }
            await (0, payment_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
            if (has(body, 'avhEmployeeId')) {
                const settings = await this.openItemsService.loadSettings(header.avhCompanyId, header.avhBranchId);
                this.assertSalesman(dto.avhEmployeeId ?? [], settings);
            }
            const now = new Date();
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: { avhVoucherId: dto.avhVoucherId, avhAccYear: dto.avhAccYear },
                },
                data: {
                    ...(has(body, 'avhRemarks') ? { avhRemarks: (0, receipt_utils_1.trimOrNull)(dto.avhRemarks) } : {}),
                    ...(has(body, 'avhUsrRefno') ? { avhUsrRefno: (0, receipt_utils_1.trimOrNull)(dto.avhUsrRefno) } : {}),
                    ...(has(body, 'avhDocRefno') ? { avhDocRefno: (0, receipt_utils_1.trimOrNull)(dto.avhDocRefno) } : {}),
                    ...(has(body, 'avhDocDate')
                        ? { avhDocDate: dto.avhDocDate ? (0, receipt_utils_1.toDateOnly)(dto.avhDocDate) : null }
                        : {}),
                    ...(has(body, 'avhEmployeeId') ? { avhEmployeeId: dto.avhEmployeeId ?? [] } : {}),
                    avhModifiedOn: now,
                    avhModifiedBy: actor,
                },
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: header.avhCompanyId,
                branchId: header.avhBranchId,
                tenantId: header.avhTenantId,
                accYear: header.avhAccYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.PAYMENT,
                srcDocId: header.avhVoucherId,
                srcDocRefno: header.avhVoucherRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED,
                fromStatus: header.avhVoucherStatus,
                toStatus: header.avhVoucherStatus,
                changedBy: actor,
                changedOn: now,
                remarks: dto.editRemark,
            });
            const updated = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
            return this.toHeaderPayload(tx, updated);
        }, PAYMENT_TRANSACTION_OPTIONS);
    }
    async deleteDraft(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT avh_voucher_id FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid AND avh_acc_year = ${dto.avhAccYear}::bpchar
           FOR UPDATE`;
            const header = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
            (0, payment_guards_1.assertHeaderScope)(header, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                accYear: dto.avhAccYear,
                voucherId: dto.avhVoucherId,
            });
            const status = (0, receipt_service_1.statusOf)(header);
            if (status !== payment_enum_1.VoucherStatus.DRAFT) {
                (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be deleted', [
                    {
                        field: 'avhVoucherId',
                        message: `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
                            (status === payment_enum_1.VoucherStatus.POSTED
                                ? 'A posted payment is money in the books — cancel it, which reverses it and leaves the trail. Only a DRAFT is deleted.'
                                : 'It has already been cancelled, and its reversal is what the books stand on. Only a DRAFT is deleted.'),
                    },
                ]);
            }
            if (header.avhAgainstVoucherId) {
                (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be deleted', [
                    {
                        field: 'avhVoucherId',
                        message: 'This is a post-dated cheque voucher, not a payment. It belongs to the payment ' +
                            `${header.avhAgainstVoucherId} and leaves play only when that one is cancelled.`,
                    },
                ]);
            }
            await (0, payment_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
            await this.assertDraftWroteNoAccounting(tx, header);
            const now = new Date();
            const otherLinesDeleted = (0, payment_draft_lines_1.rehydratePaymentDraft)(header.avhDraftLines).otherLines.length;
            const tenders = await tx.accTenderDetail.updateMany({
                where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
                data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
            });
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: {
                        avhVoucherId: header.avhVoucherId,
                        avhAccYear: header.avhAccYear,
                    },
                },
                data: { avhIsDeleted: true, avhIsActive: false, avhModifiedOn: now, avhModifiedBy: actor },
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: header.avhCompanyId,
                branchId: header.avhBranchId,
                tenantId: header.avhTenantId,
                accYear: header.avhAccYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.PAYMENT,
                srcDocId: header.avhVoucherId,
                srcDocRefno: header.avhVoucherRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.DELETED,
                fromStatus: header.avhVoucherStatus,
                toStatus: header.avhVoucherStatus,
                changedBy: actor,
                changedOn: now,
            });
            return {
                avhVoucherId: header.avhVoucherId,
                avhAccYear: header.avhAccYear,
                avhVoucherRefno: header.avhVoucherRefno,
                status,
                deletedOn: (0, receipt_utils_1.toIsoString)(now),
                deletedBy: actor,
                tendersDeleted: tenders.count,
                otherLinesDeleted,
            };
        }, PAYMENT_TRANSACTION_OPTIONS);
    }
    async assertDraftWroteNoAccounting(tx, header) {
        const [legs, adjustments] = await Promise.all([
            tx.accVoucher.count({
                where: {
                    avVoucherId: header.avhVoucherId,
                    avAccYear: header.avhAccYear,
                    avIsDeleted: false,
                },
            }),
            tx.accBillAdjustment.count({
                where: {
                    abjVoucherId: header.avhVoucherId,
                    abjVoucherAccYear: header.avhAccYear,
                    abjIsDeleted: false,
                },
            }),
        ]);
        if (legs > 0 || adjustments > 0) {
            (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be deleted', [
                {
                    field: 'avhVoucherId',
                    message: `This draft has ${legs} voucher leg(s) and ${adjustments} bill adjustment row(s) against it, ` +
                        'which a draft cannot have (R10). Deleting it would orphan them — have the voucher looked at first.',
                },
            ]);
        }
    }
    async loadHeaderOrThrow(client, voucherId, accYear) {
        const header = await client.accVoucherHeader.findFirst({
            where: {
                avhVoucherId: voucherId,
                avhAccYear: accYear,
                voucherType: { vchrTypeCode: payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE },
            },
            select: receipt_service_1.STORED_HEADER_SELECT,
        });
        if (!header || header.avhIsDeleted) {
            (0, module_service_utils_1.throwAccountsNotFound)('Payment not found', 'avhVoucherId', `No payment ${voucherId} in ${accYear}`);
        }
        if (header.avhPartyId === null) {
            (0, module_service_utils_1.throwAccountsNotFound)('Payment not found', 'avhPartyId', `Voucher ${voucherId} in ${accYear} carries no party, so it is not a payment`);
        }
        return { ...header, avhPartyId: header.avhPartyId };
    }
    async allocateNumber(tx, scope) {
        const allocated = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
            vchrTypeId: scope.voucherTypeId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            documentDate: scope.voucherDate,
        });
        const slno = await (0, voucher_sequence_helper_1.allocateVoucherSlno)(tx, scope.companyId, scope.accYear);
        return { voucherNo: allocated.lastNo, voucherSlno: slno, voucherRefno: allocated.refno };
    }
    async assertPostable(tx, header, settings) {
        if (settings.pdcPostingMode !== payment_enum_1.PdcPostingMode.ON_RECEIPT) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Posting mode is not supported', [
                {
                    field: 'accounts.pdc_posting_mode',
                    message: 'accounts.pdc_posting_mode is ON_CLEARING, which moves allocation into the cheques ' +
                        'screens — not built yet. Set it to ON_RECEIPT to post payments.',
                },
            ]);
        }
        this.assertSalesman(header.avhEmployeeId, settings);
        const tenders = await tx.accTenderDetail.findMany({
            where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
            select: { tdIsPdc: true, tdInstrumentDate: true },
        });
        if (tenders.length === 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: 'tenders', message: 'A payment with no instruments is a journal, not a payment' },
            ]);
        }
        for (const tender of tenders) {
            if (!tender.tdIsPdc || !tender.tdInstrumentDate) {
                continue;
            }
            await (0, payment_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, (0, payment_guards_1.accYearOf)(tender.tdInstrumentDate), 'tenders.tdInstrumentDate');
        }
    }
    assertSalesman(employeeIds, settings) {
        const ids = employeeIds ?? [];
        if (ids.length > 1) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'avhEmployeeId',
                    message: 'A payment is made by ONE person. The column is an array because every voucher ' +
                        "header's is, not because a payment may be shared.",
                },
            ]);
        }
        if (settings.salesmanMandatory && ids.length === 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'avhEmployeeId',
                    message: 'accounts.payment_salesman_mandatory is on — a payment must say who made it',
                },
            ]);
        }
    }
    isEditableStatus(status) {
        return (0, receipt_utils_1.asEnum)(status, payment_enum_1.VOUCHER_STATUSES, payment_enum_1.VoucherStatus.CANCELLED) === payment_enum_1.VoucherStatus.DRAFT;
    }
    async assertInstrumentYearsWritable(tx, companyId, tenders) {
        const years = new Set();
        for (const tender of tenders) {
            if (tender.isPdc && tender.instrumentDate) {
                years.add((0, payment_guards_1.accYearOf)(tender.instrumentDate));
            }
        }
        for (const year of years) {
            await (0, payment_guards_1.assertAccYearWritable)(tx, companyId, year, 'tenders.tdInstrumentDate');
        }
    }
    async upsertDraftHeader(tx, params) {
        const { dto } = params;
        const now = new Date();
        const common = {
            avhCompanyId: dto.avhCompanyId,
            avhBranchId: dto.avhBranchId,
            avhTenantId: dto.avhTenantId ?? null,
            avhVoucherTypeId: params.voucherTypeId,
            avhVoucherDate: params.paymentDate,
            avhPartyId: params.partyId,
            avhSrcModule: null,
            avhSrcDocType: null,
            avhSrcDocId: null,
            avhUsrRefno: (0, receipt_utils_1.trimOrNull)(dto.avhUsrRefno),
            avhDocRefno: (0, receipt_utils_1.trimOrNull)(dto.avhDocRefno),
            avhDocDate: dto.avhDocDate ? (0, receipt_utils_1.toDateOnly)(dto.avhDocDate) : null,
            avhDocAmount: params.docAmount,
            avhEmployeeId: dto.avhEmployeeId ?? [],
            avhRemarks: (0, receipt_utils_1.trimOrNull)(dto.avhRemarks),
            avhDeviceType: dto.avhDeviceType ?? null,
            avhDeviceId: (0, receipt_utils_1.trimOrNull)(dto.avhDeviceId),
            avhSessionId: dto.avhSessionId ?? null,
            avhUserId: params.actor,
            avhDraftLines: (0, payment_draft_lines_1.buildPaymentDraftLines)(params.draftLines.map(toOtherLinePayload), params.cheques, params.beneficiaries, params.allocations, params.creditsApplied),
        };
        if (params.existingId) {
            return tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: { avhVoucherId: params.existingId, avhAccYear: dto.avhAccYear },
                },
                data: { ...common, avhModifiedOn: now, avhModifiedBy: params.actor },
                select: { avhVoucherId: true },
            });
        }
        return tx.accVoucherHeader.create({
            data: {
                ...common,
                ...(dto.avhVoucherId ? { avhVoucherId: dto.avhVoucherId } : {}),
                avhAccYear: dto.avhAccYear,
                avhVoucherStatus: payment_enum_1.VoucherStatus.DRAFT,
                avhCreatedOn: now,
                avhCreatedBy: params.actor,
            },
            select: { avhVoucherId: true },
        });
    }
    async syncTenders(tx, params) {
        const scope = {
            tdSrcModule: tender_detail_api_types_1.TenderSrcModule.ACCOUNTS,
            tdSrcDocType: tender_detail_api_types_1.TenderSrcDocType.PAYMENT,
            tdSrcDocId: params.voucherId,
            tdCompanyId: params.dto.avhCompanyId,
            tdBranchId: params.dto.avhBranchId,
            tdTenantId: params.dto.avhTenantId ?? null,
            tdAccYear: params.dto.avhAccYear,
            tdDocDate: params.paymentDate,
            tdPartyLedgerId: params.partyId,
            tdUserId: params.actor,
            tdSessionId: params.dto.avhSessionId ?? null,
            tdDeviceId: params.dto.avhDeviceId ?? null,
            tdDrCr: tender_detail_api_types_1.TenderDrCr.CR,
        };
        const rows = params.tenders.map((tender) => ({
            ...(tender.tdId ? { tdId: tender.tdId } : {}),
            tdRowNo: tender.rowNo,
            tdTenderId: tender.tenderId,
            tdTenderTypeId: tender.tenderTypeId,
            tdTenderLedgerId: tender.tenderLedgerId,
            tdAmount: tender.amount.toFixed(2),
            tdReceivedAmt: tender.receivedAmt.toFixed(2),
            tdChangeAmt: tender.changeAmt.toFixed(2),
            tdMdrAmt: tender.mdrAmt.toFixed(2),
            tdRefNo: tender.refNo,
            tdBankName: tender.bankName,
            tdPayerVpa: tender.payerVpa,
            tdInstrumentDate: (0, receipt_utils_1.toDateString)(tender.instrumentDate),
            tdIsPdc: tender.isPdc,
            tdSettleLedgerId: tender.clearingLedgerId,
            tdNotes: tender.notes,
            tdVoucherId: null,
        }));
        const merged = params.replace ? rows : await this.keepUnmentioned(tx, scope, rows);
        const written = await this.tenderDetailService.syncDocumentTenders(tx, scope, merged, params.actor, {
            tableName: 'payment tender',
            screenName: 'Payment',
            entityName: 'Payment tender',
        });
        const byRow = new Map(written.map((row) => [row.tdRowNo, row.tdId]));
        for (const tender of params.tenders) {
            const tdId = byRow.get(tender.rowNo);
            if (!tdId) {
                continue;
            }
            await tx.$executeRaw `
        UPDATE accounts.acc_tender_detail
           SET td_beneficiary_name       = ${tender.beneficiary?.name?.slice(0, 150) ?? null},
               td_beneficiary_account_no = ${tender.beneficiary?.accountNo?.slice(0, 50) ?? null},
               td_beneficiary_ifsc       = ${tender.beneficiary?.ifsc?.slice(0, 11) ?? null}
         WHERE td_id = ${tdId}::uuid AND td_acc_year = ${params.dto.avhAccYear}::char(9)`;
        }
    }
    async keepUnmentioned(tx, scope, rows) {
        const stored = await this.tenderDetailService.findDocumentTenders(tx, scope.tdSrcModule, scope.tdSrcDocType, scope.tdSrcDocId);
        const mentioned = new Set(rows.map((row) => row.tdId).filter(Boolean));
        const mentionedRowNos = new Set(rows.map((row) => row.tdRowNo));
        const kept = stored
            .filter((row) => !mentioned.has(row.tdId) && !mentionedRowNos.has(row.tdRowNo))
            .map((row) => ({ tdId: row.tdId, tdRowNo: row.tdRowNo }));
        return [...kept, ...rows].sort((left, right) => (left.tdRowNo ?? 0) - (right.tdRowNo ?? 0));
    }
    async loadTenderPayload(client, voucherId) {
        const rows = await client.accTenderDetail.findMany({
            where: { tdSrcDocId: voucherId, tdIsDeleted: false },
            select: {
                tdId: true,
                tdRowNo: true,
                tdTenderId: true,
                tdTenderTypeId: true,
                tdTenderLedgerId: true,
                tdAmount: true,
                tdSurchargePerc: true,
                tdSurchargeAmt: true,
                tdMdrAmt: true,
                tdReceivedAmt: true,
                tdChangeAmt: true,
                tdRefNo: true,
                tdBankName: true,
                tdPayerVpa: true,
                tdInstrumentDate: true,
                tdIsPdc: true,
                tdVoucherId: true,
                tender: { select: { tndName: true } },
            },
            orderBy: { tdRowNo: 'asc' },
        });
        const beneficiaries = await client.$queryRaw `
      SELECT td_id, td_beneficiary_name, td_beneficiary_account_no, td_beneficiary_ifsc
        FROM accounts.acc_tender_detail
       WHERE td_src_doc_id = ${voucherId}::uuid AND td_is_deleted = false`;
        const beneficiaryById = new Map(beneficiaries.map((row) => [row.td_id, row]));
        const chequeByRowNo = await this.loadTenderCheques(client, voucherId, rows);
        return rows.map((row) => {
            const b = beneficiaryById.get(row.tdId);
            const beneficiary = b && (b.td_beneficiary_name || b.td_beneficiary_account_no || b.td_beneficiary_ifsc)
                ? {
                    name: b.td_beneficiary_name,
                    accountNo: b.td_beneficiary_account_no,
                    ifsc: b.td_beneficiary_ifsc,
                }
                : null;
            return {
                tdId: row.tdId,
                tdRowNo: row.tdRowNo,
                tdTenderId: row.tdTenderId,
                tdTenderName: row.tender?.tndName ?? null,
                tdTenderTypeId: row.tdTenderTypeId,
                tdTenderLedgerId: row.tdTenderLedgerId,
                tdAmount: (0, receipt_utils_1.toAmount)(row.tdAmount),
                tdSurchargePerc: (0, receipt_utils_1.toAmount)(row.tdSurchargePerc),
                tdSurchargeAmt: (0, receipt_utils_1.toAmount)(row.tdSurchargeAmt),
                tdMdrAmt: (0, receipt_utils_1.toAmount)(row.tdMdrAmt),
                tdReceivedAmt: (0, receipt_utils_1.toAmount)(row.tdReceivedAmt),
                tdChangeAmt: (0, receipt_utils_1.toAmount)(row.tdChangeAmt),
                tdRefNo: row.tdRefNo,
                tdBankName: row.tdBankName,
                tdPayerVpa: row.tdPayerVpa,
                tdInstrumentDate: (0, receipt_utils_1.toDateString)(row.tdInstrumentDate),
                tdIsPdc: row.tdIsPdc,
                tdVoucherId: row.tdVoucherId,
                beneficiary,
                cheque: chequeByRowNo.get(row.tdRowNo) ?? null,
            };
        });
    }
    async loadTenderCheques(client, voucherId, rows) {
        const out = new Map();
        const chequeRows = rows.filter((row) => row.tdTenderTypeId === payment_enum_1.CHEQUE_TENDER_TYPE_ID);
        if (chequeRows.length === 0) {
            return out;
        }
        const [header, registered] = await Promise.all([
            client.accVoucherHeader.findFirst({
                where: { avhVoucherId: voucherId },
                select: { avhDraftLines: true },
            }),
            client.accPdcRegister.findMany({
                where: {
                    apdTenderId: { in: chequeRows.map((row) => row.tdId) },
                    apdIsDeleted: false,
                    apdChequeBookId: { not: null },
                },
                select: {
                    apdTenderId: true,
                    apdChequeBookId: true,
                    apdFavouring: true,
                    apdAcPayee: true,
                    apdBankBranch: true,
                    apdIfsc: true,
                    apdMicr: true,
                    apdDrawerName: true,
                },
            }),
        ]);
        const draft = (0, payment_draft_lines_1.rehydratePaymentDraft)(header?.avhDraftLines);
        const registerByTenderId = new Map(registered.map((row) => [row.apdTenderId, row]));
        for (const row of chequeRows) {
            const stored = draft.cheques[row.tdRowNo];
            const register = registerByTenderId.get(row.tdId);
            if (stored) {
                out.set(row.tdRowNo, { ...stored, bookNo: null });
            }
            else if (register?.apdChequeBookId) {
                out.set(row.tdRowNo, {
                    chequeBookId: register.apdChequeBookId,
                    bookNo: null,
                    favouring: register.apdFavouring,
                    acPayee: register.apdAcPayee,
                    bankBranch: register.apdBankBranch,
                    ifsc: register.apdIfsc,
                    micr: register.apdMicr,
                    drawerName: register.apdDrawerName,
                });
            }
        }
        const books = await (0, cheque_book_helper_1.loadChequeBooks)(client, [...out.values()].map((cheque) => cheque.chequeBookId));
        for (const cheque of out.values()) {
            cheque.bookNo = books.get(cheque.chequeBookId)?.bookNo ?? null;
        }
        return out;
    }
    async toHeaderPayload(client, header) {
        const party = await client.accLedgerMaster.findUnique({
            where: { ledId: header.avhPartyId },
            select: { ledName: true },
        });
        return {
            avhVoucherId: header.avhVoucherId,
            avhCompanyId: header.avhCompanyId,
            avhBranchId: header.avhBranchId,
            avhTenantId: header.avhTenantId,
            avhAccYear: header.avhAccYear,
            avhVoucherTypeId: header.avhVoucherTypeId,
            avhVoucherNo: header.avhVoucherNo === null ? null : header.avhVoucherNo.toString(),
            avhVoucherSlno: header.avhVoucherSlno === null ? null : header.avhVoucherSlno.toString(),
            avhVoucherRefno: header.avhVoucherRefno,
            avhVoucherDate: (0, receipt_utils_1.toDateString)(header.avhVoucherDate),
            avhPartyId: header.avhPartyId,
            avhPartyName: party?.ledName ?? null,
            avhEmployeeId: header.avhEmployeeId,
            avhUsrRefno: header.avhUsrRefno,
            avhDocRefno: header.avhDocRefno,
            avhDocDate: (0, receipt_utils_1.toDateString)(header.avhDocDate),
            avhDocAmount: (0, receipt_utils_1.toAmount)(header.avhDocAmount),
            avhAdjustAmount: (0, receipt_utils_1.toAmount)(header.avhAdjustAmount),
            avhRoundOff: (0, receipt_utils_1.toAmount)(header.avhRoundOff),
            avhTotalDebit: (0, receipt_utils_1.toAmount)(header.avhTotalDebit),
            avhTotalCredit: (0, receipt_utils_1.toAmount)(header.avhTotalCredit),
            avhRemarks: header.avhRemarks,
            avhVoucherStatus: header.avhVoucherStatus,
            avhStatusOn: (0, receipt_utils_1.toIsoString)(header.avhStatusOn),
            avhStatusBy: header.avhStatusBy,
            avhPostedOn: (0, receipt_utils_1.toIsoString)(header.avhPostedOn),
            avhCancelReason: header.avhCancelReason,
            avhRevisionNo: header.avhRevisionNo,
            avhReversalVoucherId: header.avhReversalVoucherId,
            avhAgainstVoucherId: header.avhAgainstVoucherId,
            avhPrintCount: header.avhPrintCount,
            avhDeviceType: header.avhDeviceType,
            avhUserId: header.avhUserId,
            avhCreatedOn: (0, receipt_utils_1.toIsoString)(header.avhCreatedOn),
            avhCreatedBy: header.avhCreatedBy,
            avhModifiedOn: (0, receipt_utils_1.toIsoString)(header.avhModifiedOn),
            avhModifiedBy: header.avhModifiedBy,
        };
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        tender_detail_service_1.TenderDetailService,
        payment_open_items_service_1.PaymentOpenItemsService])
], PaymentService);
function rememberedAllocations(dto, stored) {
    if (dto.allocations === undefined) {
        return (0, payment_draft_lines_1.rehydratePaymentDraft)(stored).allocations;
    }
    return dto.allocations.map((row) => ({
        billId: row.billId,
        billAccYear: row.billAccYear,
        amount: row.amount,
        discount: row.discount ?? 0,
        writeoff: row.writeoff ?? 0,
        roundoff: row.roundoff ?? 0,
        writeoffApprovedBy: row.writeoffApprovedBy ?? null,
    }));
}
function rememberedCredits(dto, stored) {
    if (dto.creditsApplied === undefined) {
        return (0, payment_draft_lines_1.rehydratePaymentDraft)(stored).creditsApplied;
    }
    return dto.creditsApplied.map((row) => ({
        billId: row.billId,
        billAccYear: row.billAccYear,
        amount: row.amount,
    }));
}
function toOtherLinePayload(line) {
    return {
        lineNo: line.lineNo,
        role: line.role,
        ledgerId: line.ledgerId,
        ledgerName: line.ledgerName,
        drCr: line.drCr,
        amount: (0, receipt_utils_1.toAmount)(line.amount),
        settlesBill: line.settlesBill,
        narration: line.narration,
        approvedBy: line.approvedBy,
    };
}
function chequeDetailByRow(tenders) {
    const detail = {};
    for (const tender of tenders) {
        if (tender.isCheque && tender.cheque) {
            detail[tender.rowNo] = {
                chequeBookId: tender.cheque.chequeBookId,
                favouring: tender.cheque.favouring,
                acPayee: tender.cheque.acPayee,
                bankBranch: tender.cheque.bankBranch,
                ifsc: tender.cheque.ifsc,
                micr: tender.cheque.micr,
                drawerName: tender.cheque.drawerName,
            };
        }
    }
    return detail;
}
function beneficiaryByRow(tenders) {
    const detail = {};
    for (const tender of tenders) {
        if (tender.beneficiary) {
            detail[tender.rowNo] = tender.beneficiary;
        }
    }
    return detail;
}
function has(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key);
}
//# sourceMappingURL=payment.service.js.map