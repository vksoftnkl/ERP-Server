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
exports.sum = exports.money = exports.ZERO = exports.STORED_HEADER_SELECT = exports.ReceiptService = void 0;
exports.statusOf = statusOf;
exports.toOtherLinePayload = toOtherLinePayload;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const tender_detail_service_1 = require("../tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../tenderDetail/types/tender-detail-api.types");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const open_items_service_1 = require("./open-items.service");
const receipt_draft_lines_1 = require("./receipt-draft-lines");
const receipt_ledger_roles_1 = require("./receipt-ledger-roles");
const receipt_lines_1 = require("./receipt-lines");
const receipt_guards_1 = require("./receipt.guards");
const receipt_utils_1 = require("./receipt.utils");
Object.defineProperty(exports, "money", { enumerable: true, get: function () { return receipt_utils_1.money; } });
Object.defineProperty(exports, "sum", { enumerable: true, get: function () { return receipt_utils_1.sum; } });
Object.defineProperty(exports, "ZERO", { enumerable: true, get: function () { return receipt_utils_1.ZERO; } });
const receipt_enum_1 = require("./types/receipt-enum");
const RECEIPT_ROLES = Object.values(receipt_enum_1.ReceiptLedgerRole);
const RECEIPT_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
let ReceiptService = class ReceiptService {
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
        return this.prisma.$transaction((tx) => this.saveInTransaction(tx, dto, actor), RECEIPT_TRANSACTION_OPTIONS);
    }
    async saveInTransaction(tx, dto, actor) {
        const receiptDate = (0, receipt_utils_1.toDateOnly)(dto.avhVoucherDate);
        const replace = dto.replace ?? true;
        const derivedYear = (0, receipt_guards_1.accYearOf)(receiptDate);
        if (derivedYear !== dto.avhAccYear) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'avhVoucherDate',
                    message: `${dto.avhVoucherDate} falls in ${derivedYear}, but the receipt says ${dto.avhAccYear}`,
                },
            ]);
        }
        {
            await (0, receipt_guards_1.assertAccYearWritable)(tx, dto.avhCompanyId, dto.avhAccYear, 'avhAccYear');
            const partyId = dto.avhPartyId;
            const [party, voucherType, settings] = await Promise.all([
                (0, receipt_guards_1.loadParty)(tx, dto.avhCompanyId, partyId, 'avhPartyId'),
                (0, receipt_guards_1.loadReceiptVoucherType)(tx),
                this.openItemsService.loadSettings(dto.avhCompanyId, dto.avhBranchId),
            ]);
            const existing = dto.avhVoucherId
                ? await tx.accVoucherHeader.findUnique({
                    where: {
                        avhVoucherId_avhAccYear: {
                            avhVoucherId: dto.avhVoucherId,
                            avhAccYear: dto.avhAccYear,
                        },
                    },
                    select: {
                        avhVoucherId: true,
                        avhVoucherStatus: true,
                        avhIsDeleted: true,
                        avhVoucherRefno: true,
                    },
                })
                : null;
            if (dto.avhVoucherId && !existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Receipt not found', 'avhVoucherId', `No receipt ${dto.avhVoucherId} in ${dto.avhAccYear}`);
            }
            if (existing &&
                (existing.avhIsDeleted || !this.isEditableStatus(existing.avhVoucherStatus))) {
                (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be edited', [
                    {
                        field: 'avhVoucherId',
                        message: `${existing.avhVoucherRefno ?? dto.avhVoucherId} is ${existing.avhVoucherStatus}. ` +
                            'Only a DRAFT may be edited here; use /receipts/update-header for narration, or ' +
                            'cancel and re-enter to change the money.',
                    },
                ]);
            }
            const tenders = await (0, receipt_lines_1.normaliseTenders)(tx, {
                tenders: dto.tenders,
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                receiptDate,
            });
            await this.assertInstrumentYearsWritable(tx, dto.avhCompanyId, tenders);
            const roleLedgers = await (0, receipt_ledger_roles_1.describeReceiptRoleLedgers)(tx, RECEIPT_ROLES, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
            });
            const { lines, expected } = await (0, receipt_lines_1.normaliseOtherLines)(tx, {
                lines: dto.otherLines ?? [],
                tenders,
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                party,
                partyId,
                settings,
                ledgerForRole: (role) => {
                    const resolved = (0, receipt_ledger_roles_1.ledgerForRole)(roleLedgers, role);
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
                receiptDate,
                docAmount,
                draftLines: lines,
                cheques: chequeDetailByRow(tenders),
                actor,
            });
            await this.syncTenders(tx, {
                dto,
                voucherId: header.avhVoucherId,
                partyId,
                receiptDate,
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
                    srcDocType: txn_status_log_helper_1.TxnStatusDocType.RECEIPT,
                    srcDocId: header.avhVoucherId,
                    event: txn_status_log_helper_1.TxnStatusEvent.CREATED,
                    toStatus: receipt_enum_1.VoucherStatus.DRAFT,
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
                expectedRoles: expected.missing,
            };
        }
    }
    async get(query) {
        const header = await this.loadHeaderOrThrow(this.prisma, query.avhVoucherId, query.avhAccYear);
        (0, receipt_guards_1.assertHeaderScope)(header, {
            companyId: query.avhCompanyId,
            branchId: query.avhBranchId,
            accYear: query.avhAccYear,
            voucherId: query.avhVoucherId,
        });
        return this.loadFullReceipt(this.prisma, header);
    }
    async loadFullReceipt(client, header) {
        const pdcHeaders = await client.accVoucherHeader.findMany({
            where: {
                avhAgainstVoucherId: header.avhVoucherId,
                avhIsDeleted: false,
            },
            select: exports.STORED_HEADER_SELECT,
            orderBy: { avhVoucherDate: 'asc' },
        });
        const voucherIds = [header.avhVoucherId, ...pdcHeaders.map((row) => row.avhVoucherId)];
        const years = [...new Set([header.avhAccYear, ...pdcHeaders.map((row) => row.avhAccYear)])];
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
                    bill: { select: { ablDocRefno: true, ablDocDate: true, ablBillType: true } },
                    againstBill: { select: { ablDocRefno: true } },
                },
                orderBy: [{ abjAdjDate: 'asc' }, { abjRowNo: 'asc' }],
            }),
            client.accPdcRegister.findMany({
                where: {
                    apdVoucherId: { in: voucherIds },
                    apdIsDeleted: false,
                },
                select: {
                    apdId: true,
                    apdAccYear: true,
                    apdInstrumentType: true,
                    apdInstrumentNo: true,
                    apdInstrumentDate: true,
                    apdAmount: true,
                    apdBankName: true,
                    apdBankBranch: true,
                    apdIfsc: true,
                    apdDrawerName: true,
                    apdBankLedgerId: true,
                    apdStatus: true,
                    apdPostingMode: true,
                    apdVoucherId: true,
                    apdTenderId: true,
                },
                orderBy: { apdInstrumentDate: 'asc' },
            }),
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
            approvedBy: row.abjApprovedBy,
            remarks: row.abjRemarks,
        });
        const tenderRowByPdc = new Map();
        const tenderRows = await client.accTenderDetail.findMany({
            where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
            select: { tdId: true, tdRowNo: true },
        });
        const rowNoByTenderId = new Map(tenderRows.map((row) => [row.tdId, row.tdRowNo]));
        for (const cheque of cheques) {
            tenderRowByPdc.set(cheque.apdId, cheque.apdTenderId ? (rowNoByTenderId.get(cheque.apdTenderId) ?? null) : null);
        }
        return {
            header: await this.toHeaderPayload(client, header),
            tenders: await this.loadTenderPayload(client, header.avhVoucherId),
            otherLines: (0, receipt_draft_lines_1.rehydrateDraft)(header.avhDraftLines).otherLines,
            legs: legsFor(header.avhVoucherId),
            allocations: adjustments.filter((row) => row.abjAgainstBillId === null).map(toAllocation),
            creditsApplied: adjustments.filter((row) => row.abjAgainstBillId !== null).map(toAllocation),
            cheques: cheques.map((cheque) => ({
                pdcId: cheque.apdId,
                accYear: cheque.apdAccYear,
                tenderRowNo: tenderRowByPdc.get(cheque.apdId) ?? null,
                instrumentType: cheque.apdInstrumentType,
                instrumentNo: cheque.apdInstrumentNo,
                instrumentDate: (0, receipt_utils_1.toDateString)(cheque.apdInstrumentDate),
                amount: (0, receipt_utils_1.toAmount)(cheque.apdAmount),
                bankName: cheque.apdBankName,
                bankBranch: cheque.apdBankBranch,
                ifsc: cheque.apdIfsc,
                drawerName: cheque.apdDrawerName,
                bankLedgerId: cheque.apdBankLedgerId,
                status: cheque.apdStatus,
                postingMode: cheque.apdPostingMode,
                voucherId: cheque.apdVoucherId,
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
                    message: `${rejected.join(', ')} cannot be changed on a posted receipt. Money is changed by ` +
                        'cancelling and re-entering (R3).',
                },
            ]);
        }
        return this.prisma.$transaction(async (tx) => {
            const header = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
            (0, receipt_guards_1.assertHeaderScope)(header, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                accYear: dto.avhAccYear,
                voucherId: dto.avhVoucherId,
            });
            if (statusOf(header) === receipt_enum_1.VoucherStatus.CANCELLED) {
                (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be edited', [
                    { field: 'avhVoucherId', message: 'A cancelled receipt is closed to edits' },
                ]);
            }
            await (0, receipt_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
            const now = new Date();
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: {
                        avhVoucherId: dto.avhVoucherId,
                        avhAccYear: dto.avhAccYear,
                    },
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
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.RECEIPT,
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
        }, RECEIPT_TRANSACTION_OPTIONS);
    }
    async deleteDraft(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT avh_voucher_id
          FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid
           AND avh_acc_year   = ${dto.avhAccYear}::bpchar
           FOR UPDATE`;
            const header = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
            (0, receipt_guards_1.assertHeaderScope)(header, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                accYear: dto.avhAccYear,
                voucherId: dto.avhVoucherId,
            });
            const status = statusOf(header);
            if (status !== receipt_enum_1.VoucherStatus.DRAFT) {
                (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be deleted', [
                    {
                        field: 'avhVoucherId',
                        message: `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
                            (status === receipt_enum_1.VoucherStatus.POSTED
                                ? 'A posted receipt is money in the books — cancel it, which reverses it and ' +
                                    'leaves the trail. Only a DRAFT is deleted.'
                                : 'It has already been cancelled, and its reversal is what the books stand on. ' +
                                    'Only a DRAFT is deleted.'),
                    },
                ]);
            }
            if (header.avhAgainstVoucherId) {
                (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be deleted', [
                    {
                        field: 'avhVoucherId',
                        message: 'This is a post-dated cheque voucher, not a receipt. It belongs to the receipt ' +
                            `${header.avhAgainstVoucherId} and leaves play only when that one is cancelled.`,
                    },
                ]);
            }
            await (0, receipt_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
            await this.assertDraftWroteNoAccounting(tx, header);
            const now = new Date();
            const otherLinesDeleted = (0, receipt_draft_lines_1.rehydrateDraft)(header.avhDraftLines).otherLines.length;
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
                data: {
                    avhIsDeleted: true,
                    avhIsActive: false,
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
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.RECEIPT,
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
        }, RECEIPT_TRANSACTION_OPTIONS);
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
            (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be deleted', [
                {
                    field: 'avhVoucherId',
                    message: `This draft has ${legs} voucher leg(s) and ${adjustments} bill adjustment row(s) ` +
                        'against it, which a draft cannot have (R10). Deleting it would orphan them. It has ' +
                        'most likely been posted without its status following — have the voucher looked at ' +
                        'before it is removed.',
                },
            ]);
        }
    }
    async loadHeaderOrThrow(client, voucherId, accYear) {
        const header = await client.accVoucherHeader.findUnique({
            where: { avhVoucherId_avhAccYear: { avhVoucherId: voucherId, avhAccYear: accYear } },
            select: exports.STORED_HEADER_SELECT,
        });
        if (!header || header.avhIsDeleted) {
            (0, module_service_utils_1.throwAccountsNotFound)('Receipt not found', 'avhVoucherId', `No receipt ${voucherId} in ${accYear}`);
        }
        return header;
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
        return {
            voucherNo: allocated.lastNo,
            voucherSlno: slno,
            voucherRefno: allocated.refno,
        };
    }
    async assertPostable(tx, header, settings) {
        if (settings.pdcPostingMode !== receipt_enum_1.PdcPostingMode.ON_RECEIPT) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Posting mode is not supported', [
                {
                    field: 'accounts.pdc_posting_mode',
                    message: 'accounts.pdc_posting_mode is ON_CLEARING, which moves allocation into the Received ' +
                        'Cheques screen — not built yet. Set it to ON_RECEIPT to post receipts.',
                },
            ]);
        }
        this.assertSalesman(header.avhEmployeeId, settings);
        const tenders = await tx.accTenderDetail.findMany({
            where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
            select: { tdIsPdc: true, tdInstrumentDate: true, tdAmount: true },
        });
        if (tenders.length === 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'tenders',
                    message: 'A receipt with no instruments is a journal, not a receipt',
                },
            ]);
        }
        for (const tender of tenders) {
            if (!tender.tdIsPdc || !tender.tdInstrumentDate) {
                continue;
            }
            const year = (0, receipt_guards_1.accYearOf)(tender.tdInstrumentDate);
            await (0, receipt_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, year, 'tenders.tdInstrumentDate');
        }
    }
    assertSalesman(employeeIds, settings) {
        const ids = employeeIds ?? [];
        if (ids.length > 1) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'avhEmployeeId',
                    message: 'A receipt is collected by ONE person. The column is an array because every voucher ' +
                        "header's is, not because a collection may be shared.",
                },
            ]);
        }
        if (settings.salesmanMandatory && ids.length === 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'avhEmployeeId',
                    message: 'accounts.receipt_salesman_mandatory is on — a receipt must say who collected it',
                },
            ]);
        }
    }
    isEditableStatus(status) {
        return (0, receipt_utils_1.asEnum)(status, receipt_enum_1.VOUCHER_STATUSES, receipt_enum_1.VoucherStatus.CANCELLED) === receipt_enum_1.VoucherStatus.DRAFT;
    }
    async assertInstrumentYearsWritable(tx, companyId, tenders) {
        const years = new Set();
        for (const tender of tenders) {
            if (tender.isPdc && tender.instrumentDate) {
                years.add((0, receipt_guards_1.accYearOf)(tender.instrumentDate));
            }
        }
        for (const year of years) {
            await (0, receipt_guards_1.assertAccYearWritable)(tx, companyId, year, 'tenders.tdInstrumentDate');
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
            avhVoucherDate: params.receiptDate,
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
            avhDraftLines: (0, receipt_draft_lines_1.buildDraftLines)(params.draftLines.map(toOtherLinePayload), params.cheques),
        };
        if (params.existingId) {
            const updated = await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: {
                        avhVoucherId: params.existingId,
                        avhAccYear: dto.avhAccYear,
                    },
                },
                data: { ...common, avhModifiedOn: now, avhModifiedBy: params.actor },
                select: { avhVoucherId: true },
            });
            return updated;
        }
        const created = await tx.accVoucherHeader.create({
            data: {
                ...common,
                ...(dto.avhVoucherId ? { avhVoucherId: dto.avhVoucherId } : {}),
                avhAccYear: dto.avhAccYear,
                avhVoucherStatus: receipt_enum_1.VoucherStatus.DRAFT,
                avhCreatedOn: now,
                avhCreatedBy: params.actor,
            },
            select: { avhVoucherId: true },
        });
        return created;
    }
    async syncTenders(tx, params) {
        const scope = {
            tdSrcModule: tender_detail_api_types_1.TenderSrcModule.ACCOUNTS,
            tdSrcDocType: tender_detail_api_types_1.TenderSrcDocType.RECEIPT,
            tdSrcDocId: params.voucherId,
            tdCompanyId: params.dto.avhCompanyId,
            tdBranchId: params.dto.avhBranchId,
            tdTenantId: params.dto.avhTenantId ?? null,
            tdAccYear: params.dto.avhAccYear,
            tdDocDate: params.receiptDate,
            tdPartyLedgerId: params.partyId,
            tdUserId: params.actor,
            tdSessionId: params.dto.avhSessionId ?? null,
            tdDeviceId: params.dto.avhDeviceId ?? null,
            tdDrCr: tender_detail_api_types_1.TenderDrCr.DR,
        };
        const rows = params.tenders.map((tender) => ({
            ...(tender.tdId ? { tdId: tender.tdId } : {}),
            tdRowNo: tender.rowNo,
            tdTenderId: tender.tenderId,
            tdTenderTypeId: tender.tenderTypeId,
            tdTenderLedgerId: tender.tenderLedgerId,
            tdSurchargeLedgerId: tender.surchargeLedgerId,
            tdAmount: tender.amount.toFixed(2),
            tdSurchargePerc: tender.surchargePerc.toFixed(3),
            tdSurchargeAmt: tender.surchargeAmt.toFixed(2),
            tdReceivedAmt: tender.receivedAmt.toFixed(2),
            tdChangeAmt: tender.changeAmt.toFixed(2),
            tdMdrAmt: tender.mdrAmt.toFixed(2),
            tdRefNo: tender.refNo,
            tdAuthCode: tender.authCode,
            tdCardLast4: tender.cardLast4,
            tdBankName: tender.bankName,
            tdPayerVpa: tender.payerVpa,
            tdInstrumentDate: (0, receipt_utils_1.toDateString)(tender.instrumentDate),
            tdIsPdc: tender.isPdc,
            tdSettleLedgerId: tender.clearingLedgerId,
            tdNotes: tender.notes,
            tdVoucherId: null,
        }));
        const merged = params.replace ? rows : await this.keepUnmentioned(tx, scope, rows);
        await this.tenderDetailService.syncDocumentTenders(tx, scope, merged, params.actor, {
            tableName: 'receipt tender',
            screenName: 'Receipt',
            entityName: 'Receipt tender',
        });
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
        return rows.map((row) => ({
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
        }));
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
exports.ReceiptService = ReceiptService;
exports.ReceiptService = ReceiptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        tender_detail_service_1.TenderDetailService,
        open_items_service_1.OpenItemsService])
], ReceiptService);
exports.STORED_HEADER_SELECT = {
    avhVoucherId: true,
    avhCompanyId: true,
    avhBranchId: true,
    avhTenantId: true,
    avhAccYear: true,
    avhVoucherTypeId: true,
    avhVoucherNo: true,
    avhVoucherSlno: true,
    avhVoucherRefno: true,
    avhVoucherDate: true,
    avhSrcModule: true,
    avhSrcDocType: true,
    avhSrcDocId: true,
    avhPartyId: true,
    avhEmployeeId: true,
    avhUsrRefno: true,
    avhDocRefno: true,
    avhDocDate: true,
    avhDocAmount: true,
    avhAdjustAmount: true,
    avhRoundOff: true,
    avhTotalDebit: true,
    avhTotalCredit: true,
    avhRemarks: true,
    avhVoucherStatus: true,
    avhStatusOn: true,
    avhStatusBy: true,
    avhPostedOn: true,
    avhCancelReason: true,
    avhRevisionNo: true,
    avhReversalVoucherId: true,
    avhReversalAccYear: true,
    avhAgainstVoucherId: true,
    avhAgainstAccYear: true,
    avhPrintCount: true,
    avhDeviceType: true,
    avhDeviceId: true,
    avhSessionId: true,
    avhUserId: true,
    avhDraftLines: true,
    avhIsDeleted: true,
    avhCreatedOn: true,
    avhCreatedBy: true,
    avhModifiedOn: true,
    avhModifiedBy: true,
};
function statusOf(header) {
    return (0, receipt_utils_1.asEnum)(header.avhVoucherStatus, receipt_enum_1.VOUCHER_STATUSES, receipt_enum_1.VoucherStatus.DRAFT);
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
    };
}
function chequeDetailByRow(tenders) {
    const detail = {};
    for (const tender of tenders) {
        if (tender.isCheque && tender.cheque) {
            detail[tender.rowNo] = tender.cheque;
        }
    }
    return detail;
}
function has(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key);
}
//# sourceMappingURL=receipt.service.js.map