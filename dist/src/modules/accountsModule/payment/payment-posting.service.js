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
exports.PaymentPostingService = void 0;
exports.rethrowAllocationError = rethrowAllocationError;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const voucher_totals_helper_1 = require("../accountVoucherHeader/voucher-totals.helper");
const voucher_books_helper_1 = require("../vouchers/voucher-books.helper");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const cheque_book_helper_1 = require("../vouchers/cheque-book.helper");
const cheques_utils_1 = require("../cheques/cheques.utils");
const allocation_engine_1 = require("../receipt/allocation-engine");
const receipt_utils_1 = require("../receipt/receipt.utils");
const payment_service_1 = require("./payment.service");
const payment_open_items_service_1 = require("./payment-open-items.service");
const payment_ledger_roles_1 = require("./payment-ledger-roles");
const payment_draft_lines_1 = require("./payment-draft-lines");
const payment_lines_1 = require("./payment-lines");
const payment_tds_1 = require("./payment-tds");
const payment_guards_1 = require("./payment.guards");
const payment_enum_1 = require("./types/payment-enum");
const POST_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
let PaymentPostingService = class PaymentPostingService {
    prisma;
    requestContext;
    paymentService;
    openItemsService;
    recompute;
    constructor(prisma, requestContext, paymentService, openItemsService, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.paymentService = paymentService;
        this.openItemsService = openItemsService;
        this.recompute = recompute;
    }
    async post(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction((tx) => this.postInTransaction(tx, dto, actor), POST_TRANSACTION_OPTIONS);
        }
        catch (error) {
            throw rethrowAllocationError(error);
        }
    }
    async postInTransaction(tx, dto, actor) {
        await this.lockHeader(tx, dto.avhVoucherId, dto.avhAccYear);
        const header = await this.paymentService.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
        (0, payment_guards_1.assertHeaderScope)(header, {
            companyId: dto.avhCompanyId,
            branchId: dto.avhBranchId,
            accYear: dto.avhAccYear,
            voucherId: dto.avhVoucherId,
        });
        const settings = await this.openItemsService.loadSettings(header.avhCompanyId, header.avhBranchId);
        this.assertStatusMayPost(header);
        await (0, payment_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
        await (0, payment_guards_1.assertVoucherPartitionExists)(tx, header.avhAccYear, 'avhAccYear');
        await this.paymentService.assertPostable(tx, header, settings);
        const party = await (0, payment_guards_1.loadPayee)(tx, header.avhCompanyId, header.avhPartyId);
        const paymentDate = startOfDay(header.avhVoucherDate);
        const { tenders, otherLines, tds } = await this.rebuildLines(tx, header, paymentDate, settings, party);
        const locked = await (0, payment_guards_1.lockBills)(tx, [
            ...dto.allocations.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
            ...dto.creditsApplied.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
        ]);
        const bills = dto.allocations.map((row, index) => {
            const bill = (0, payment_guards_1.assertPayableUsable)(locked.get(`${row.billId}|${row.billAccYear}`), {
                billId: row.billId,
                partyId: header.avhPartyId,
                companyId: header.avhCompanyId,
                kind: 'PAYABLE',
                field: `allocations.${index}.billId`,
            });
            return {
                billId: bill.ablId,
                billAccYear: bill.ablAccYear,
                docRefno: bill.ablDocRefno,
                amount: (0, receipt_utils_1.money)(row.amount),
                discount: (0, receipt_utils_1.money)(row.discount ?? 0),
                writeoff: (0, receipt_utils_1.money)(row.writeoff ?? 0),
                roundoff: (0, receipt_utils_1.money)(row.roundoff ?? 0),
                pendingAmount: bill.ablPendingAmount,
                writeoffApprovedBy: row.writeoffApprovedBy ?? null,
            };
        });
        const credits = dto.creditsApplied.map((row, index) => {
            const bill = (0, payment_guards_1.assertPayableUsable)(locked.get(`${row.billId}|${row.billAccYear}`), {
                billId: row.billId,
                partyId: header.avhPartyId,
                companyId: header.avhCompanyId,
                kind: 'DEBIT',
                field: `creditsApplied.${index}.billId`,
            });
            const routing = (0, payment_enum_1.debitRouting)(bill.ablBillType);
            return {
                billId: bill.ablId,
                billAccYear: bill.ablAccYear,
                billType: bill.ablBillType,
                docRefno: bill.ablDocRefno,
                amount: (0, receipt_utils_1.money)(row.amount),
                pendingAmount: bill.ablPendingAmount,
                adjType: routing.adjType,
                settlementMode: routing.settlementMode,
            };
        });
        this.assertWriteoffsApproved(bills, settings.writeoffApprovalAbove);
        const plan = (0, allocation_engine_1.allocate)({
            receiptDate: paymentDate,
            direction: 'OUT',
            bills,
            credits,
            otherLines: otherLines.map((line) => ({
                lineNo: line.lineNo,
                role: line.role,
                ledgerId: line.ledgerId,
                drCr: line.drCr,
                amount: line.amount,
                settlesBill: line.settlesBill,
                settlementMode: line.settlementMode,
                isInstrumentSplit: line.isInstrumentSplit,
                approvedBy: line.approvedBy,
            })),
            tenders: tenders.map((tender) => ({
                tenderRowNo: tender.rowNo,
                amount: tender.amount,
                isCheque: tender.isCheque,
                isPostDated: tender.isPdc,
                instrumentDate: tender.instrumentDate,
                settlementMode: tender.settlementMode,
            })),
            pins: dto.otherLineBills.map((pin) => ({
                lineNo: pin.lineNo,
                billId: pin.billId,
                billAccYear: pin.billAccYear,
                amount: (0, receipt_utils_1.money)(pin.amount),
            })),
            claimedOnAccount: (0, receipt_utils_1.money)(dto.onAccount),
        });
        const vouchers = await this.planVouchers(tx, header, tenders, plan, actor);
        const byKey = new Map(vouchers.map((voucher) => [voucher.key, voucher]));
        const tenderIdByRow = await this.tenderIdsByRow(tx, header.avhVoucherId);
        const leaves = await this.takeLeaves(tx, header, tenders, tenderIdByRow, actor);
        const registerByTenderRow = await this.writeRegisterRows(tx, {
            header,
            tenders,
            vouchers: byKey,
            leaves,
            paymentDate,
            actor,
            postingMode: settings.pdcPostingMode,
        });
        await this.writeLegs(tx, { header, tenders, otherLines, bills, plan, vouchers: byKey, actor });
        await this.writeAdjustments(tx, {
            header,
            plan,
            vouchers: byKey,
            tenderIdByRow,
            registerByTenderRow,
            otherLines,
            actor,
        });
        await this.writeAdvanceBills(tx, { header, plan, vouchers: byKey, actor });
        await this.linkInstruments(tx, {
            header,
            tenders,
            vouchers: byKey,
            tenderIdByRow,
            registerByTenderRow,
        });
        const touched = [
            ...bills.map((bill) => ({ billId: bill.billId, accYear: bill.billAccYear })),
            ...credits.map((credit) => ({ billId: credit.billId, accYear: credit.billAccYear })),
        ];
        const recomputed = await this.recompute.recomputeBills(tx, touched, (0, receipt_utils_1.todayUtc)());
        const paymentVoucher = byKey.get(allocation_engine_1.RECEIPT_VOUCHER_KEY);
        if (tds) {
            await this.writeTdsRegister(tx, {
                header,
                party,
                tds,
                refno: paymentVoucher.voucherRefno,
                actor,
            });
        }
        await this.postHeaders(tx, { header, vouchers, plan, tenders, actor });
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
            tenantId: header.avhTenantId,
            accYear: header.avhAccYear,
            srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
            srcDocType: txn_status_log_helper_1.TxnStatusDocType.PAYMENT,
            srcDocId: header.avhVoucherId,
            srcDocRefno: paymentVoucher.voucherRefno,
            event: txn_status_log_helper_1.TxnStatusEvent.POSTED,
            fromStatus: header.avhVoucherStatus,
            toStatus: payment_enum_1.VoucherStatus.POSTED,
            changedBy: actor,
            deviceId: header.avhDeviceId,
            sessionId: header.avhSessionId,
        });
        const now = new Date();
        for (const tender of tenders.filter((row) => row.isCheque)) {
            const register = registerByTenderRow.get(tender.rowNo);
            const leaf = leaves.get(tender.rowNo);
            if (!register || !leaf) {
                continue;
            }
            await (0, cheques_utils_1.logChequeStatus)(tx, {
                apdId: register.apdId,
                apdAccYear: register.apdAccYear,
                apdCompanyId: header.avhCompanyId,
                apdBranchId: header.avhBranchId,
                apdTenantId: header.avhTenantId,
                apdInstrumentNo: leaf.leaf,
                apdTraType: payment_enum_1.PdcTraType.PAID,
            }, {
                fromStatus: null,
                toStatus: payment_enum_1.PdcStatus.HELD,
                remarks: `Issued on payment ${paymentVoucher.voucherRefno}: leaf ${leaf.leaf} of book ${leaf.bookNo}`,
                actor,
                changedOn: now,
                sessionId: header.avhSessionId,
            });
        }
        const movedLedgers = await tx.accVoucher.findMany({
            where: {
                avVoucherId: { in: vouchers.map((voucher) => voucher.voucherId) },
                avIsDeleted: false,
            },
            select: { avLedgerId: true },
            distinct: ['avLedgerId'],
        });
        await (0, voucher_books_helper_1.assertVoucherBooksReconcile)(tx, {
            companyId: header.avhCompanyId,
            accYear: header.avhAccYear,
            ledgerIds: [header.avhPartyId, ...movedLedgers.map((leg) => leg.avLedgerId)],
        });
        const posted = await this.paymentService.loadHeaderOrThrow(tx, header.avhVoucherId, header.avhAccYear);
        const full = await this.paymentService.loadFullPayment(tx, posted);
        const held = await this.postDatedHeldByBill(tx, touched);
        return {
            ...full,
            numberedVouchers: vouchers.map((voucher) => ({
                voucherId: voucher.voucherId,
                accYear: voucher.accYear,
                voucherRefno: voucher.voucherRefno,
                voucherDate: (0, receipt_utils_1.toDateString)(voucher.voucherDate),
                docAmount: (0, receipt_utils_1.toAmount)(voucher.docAmount),
                adjustAmount: (0, receipt_utils_1.toAmount)(plan.adjustAmountByVoucher.get(voucher.key) ?? receipt_utils_1.ZERO),
                isPdcVoucher: voucher.tenderRowNo !== null,
            })),
            billsAfter: recomputed.map((bill) => ({
                billId: bill.billId,
                billAccYear: bill.accYear,
                docRefno: bills.find((row) => row.billId === bill.billId)?.docRefno ??
                    credits.find((row) => row.billId === bill.billId)?.docRefno ??
                    '',
                billAmount: (0, receipt_utils_1.toAmount)(bill.billAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(bill.pendingAmount),
                postDatedHeld: (0, receipt_utils_1.toAmount)(held.get(`${bill.billId}|${bill.accYear}`) ?? receipt_utils_1.ZERO),
            })),
            totalOnAccount: (0, receipt_utils_1.toAmount)(plan.totalOnAccount),
            cheques: tenders
                .filter((tender) => tender.isCheque && leaves.has(tender.rowNo))
                .map((tender) => {
                const leaf = leaves.get(tender.rowNo);
                const register = registerByTenderRow.get(tender.rowNo);
                return {
                    tdRowNo: tender.rowNo,
                    apdId: register.apdId,
                    apdAccYear: register.apdAccYear,
                    leaf: leaf.leaf,
                    bookNo: leaf.bookNo,
                };
            }),
        };
    }
    async lockHeader(tx, voucherId, accYear) {
        await tx.$queryRaw `
      SELECT avh_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::bpchar
         FOR UPDATE`;
    }
    assertStatusMayPost(header) {
        const status = (0, payment_service_1.statusOf)(header);
        if (status === payment_enum_1.VoucherStatus.DRAFT) {
            return;
        }
        (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be posted', [
            {
                field: 'avhVoucherId',
                message: `${header.avhVoucherRefno ?? header.avhVoucherId} is ${status}, and only a DRAFT may be posted.` +
                    (status === payment_enum_1.VoucherStatus.POSTED
                        ? ' It has already been posted — cancel it and re-enter if the money was wrong.'
                        : ''),
            },
        ]);
    }
    assertWriteoffsApproved(bills, threshold) {
        bills.forEach((bill, index) => {
            if (bill.writeoff.lessThanOrEqualTo(0)) {
                return;
            }
            if (bill.writeoff.greaterThan(threshold) && !bill.writeoffApprovedBy) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: `allocations.${index}.writeoffApprovedBy`,
                        message: `Writing back ${bill.writeoff.toFixed(2)} on ${bill.docRefno} needs an approver ` +
                            `(accounts.writeoff_approval_above is ${threshold.toFixed(2)})`,
                    },
                ]);
            }
        });
    }
    async rebuildLines(tx, header, paymentDate, settings, party) {
        const draft = (0, payment_draft_lines_1.rehydratePaymentDraft)(header.avhDraftLines);
        const stored = await tx.accTenderDetail.findMany({
            where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
            orderBy: { tdRowNo: 'asc' },
        });
        const tenders = await (0, payment_lines_1.normalisePaymentTenders)(tx, {
            tenders: stored.map((row) => {
                const cheque = draft.cheques[row.tdRowNo];
                const beneficiary = draft.beneficiaries[row.tdRowNo];
                return {
                    tdId: row.tdId,
                    tdRowNo: row.tdRowNo,
                    tdTenderId: row.tdTenderId,
                    tdTenderTypeId: row.tdTenderTypeId,
                    tdTenderLedgerId: row.tdTenderLedgerId,
                    tdAmount: row.tdAmount,
                    tdReceivedAmt: row.tdReceivedAmt,
                    tdChangeAmt: row.tdChangeAmt,
                    tdMdrAmt: row.tdMdrAmt,
                    tdRefNo: cheque ? null : row.tdRefNo,
                    tdBankName: row.tdBankName,
                    tdPayerVpa: row.tdPayerVpa,
                    tdInstrumentDate: (0, receipt_utils_1.toDateString)(row.tdInstrumentDate),
                    tdNotes: row.tdNotes,
                    cheque: cheque
                        ? {
                            chequeBookId: cheque.chequeBookId,
                            favouring: cheque.favouring,
                            acPayee: cheque.acPayee,
                            bankBranch: cheque.bankBranch,
                            ifsc: cheque.ifsc,
                            micr: cheque.micr,
                            drawerName: cheque.drawerName,
                        }
                        : undefined,
                    beneficiary: beneficiary
                        ? { name: beneficiary.name, accountNo: beneficiary.accountNo, ifsc: beneficiary.ifsc }
                        : undefined,
                };
            }),
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
            paymentDate,
            partyName: party.ledName,
        });
        const roles = new Set(draft.otherLines.map((line) => line.role).filter((role) => role !== null));
        if (tenders.some((tender) => tender.mdrAmt.greaterThan(0))) {
            roles.add(payment_enum_1.PaymentLedgerRole.BANK_CHARGES);
        }
        if (party.ledIsTdsApplicable) {
            roles.add(payment_enum_1.PaymentLedgerRole.TDS_PAYABLE);
        }
        const roleLedgers = await (0, payment_ledger_roles_1.requirePaymentRoleLedgers)(tx, [...roles], {
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
        });
        const tdsFacts = await (0, payment_tds_1.loadPaymentTdsFacts)(tx, {
            companyId: header.avhCompanyId,
            party,
            accYear: header.avhAccYear,
            date: (0, receipt_utils_1.toDateString)(paymentDate),
        });
        const { lines, tds } = await (0, payment_lines_1.normalisePaymentOtherLines)(tx, {
            lines: draft.otherLines.map((line) => ({
                role: line.role ?? undefined,
                ledgerId: line.role ? undefined : line.ledgerId,
                drCr: line.drCr,
                amount: line.amount,
                settlesBill: line.settlesBill,
                narration: line.narration,
                approvedBy: line.approvedBy,
            })),
            tenders,
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
            party,
            partyId: header.avhPartyId,
            settings,
            tds: tdsFacts,
            ledgerForRole: (role) => {
                const resolved = (0, payment_ledger_roles_1.ledgerForRole)(roleLedgers, role);
                return resolved ? { ledgerId: resolved.ledgerId, ledgerName: resolved.ledgerName } : null;
            },
        });
        return { tenders, otherLines: lines, tds };
    }
    async planVouchers(tx, header, tenders, plan, actor) {
        const vouchers = [];
        const number = header.avhVoucherRefno
            ? {
                voucherNo: header.avhVoucherNo,
                voucherSlno: header.avhVoucherSlno,
                voucherRefno: header.avhVoucherRefno,
            }
            : await this.paymentService.allocateNumber(tx, {
                companyId: header.avhCompanyId,
                branchId: header.avhBranchId,
                accYear: header.avhAccYear,
                voucherTypeId: header.avhVoucherTypeId,
                voucherDate: header.avhVoucherDate,
            });
        if (!header.avhVoucherRefno) {
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: {
                        avhVoucherId: header.avhVoucherId,
                        avhAccYear: header.avhAccYear,
                    },
                },
                data: {
                    avhVoucherNo: number.voucherNo,
                    avhVoucherSlno: number.voucherSlno,
                    avhVoucherRefno: number.voucherRefno,
                },
            });
        }
        vouchers.push({
            key: allocation_engine_1.RECEIPT_VOUCHER_KEY,
            tenderRowNo: null,
            voucherDate: header.avhVoucherDate,
            accYear: header.avhAccYear,
            docAmount: (0, receipt_utils_1.sum)(tenders.filter((tender) => !tender.isPdc).map((tender) => tender.amount)),
            voucherId: header.avhVoucherId,
            voucherNo: number.voucherNo,
            voucherRefno: number.voucherRefno,
        });
        for (const tender of tenders.filter((row) => row.isPdc)) {
            const voucherDate = tender.instrumentDate;
            const accYear = (0, payment_guards_1.accYearOf)(voucherDate);
            await (0, payment_guards_1.assertAccYearWritable)(tx, header.avhCompanyId, accYear, 'tenders.tdInstrumentDate');
            await (0, payment_guards_1.assertVoucherPartitionExists)(tx, accYear, 'tenders.tdInstrumentDate');
            const pdcNumber = await this.paymentService.allocateNumber(tx, {
                companyId: header.avhCompanyId,
                branchId: header.avhBranchId,
                accYear,
                voucherTypeId: header.avhVoucherTypeId,
                voucherDate,
            });
            const created = await tx.accVoucherHeader.create({
                data: {
                    avhCompanyId: header.avhCompanyId,
                    avhBranchId: header.avhBranchId,
                    avhTenantId: header.avhTenantId,
                    avhAccYear: accYear,
                    avhVoucherTypeId: header.avhVoucherTypeId,
                    avhVoucherNo: pdcNumber.voucherNo,
                    avhVoucherSlno: pdcNumber.voucherSlno,
                    avhVoucherRefno: pdcNumber.voucherRefno,
                    avhVoucherDate: voucherDate,
                    avhPartyId: header.avhPartyId,
                    avhEmployeeId: header.avhEmployeeId,
                    avhDocAmount: tender.amount,
                    avhUsrRefno: header.avhUsrRefno,
                    avhRemarks: `Post-dated ${tender.tenderName} on payment ${number.voucherRefno}`.trim(),
                    avhAgainstVoucherId: header.avhVoucherId,
                    avhAgainstAccYear: header.avhAccYear,
                    avhDeviceType: header.avhDeviceType,
                    avhDeviceId: header.avhDeviceId,
                    avhSessionId: header.avhSessionId,
                    avhUserId: header.avhUserId,
                    avhVoucherStatus: payment_enum_1.VoucherStatus.DRAFT,
                    avhCreatedBy: actor,
                },
                select: { avhVoucherId: true },
            });
            vouchers.push({
                key: (0, allocation_engine_1.pdcVoucherKey)(tender.rowNo),
                tenderRowNo: tender.rowNo,
                voucherDate,
                accYear,
                docAmount: tender.amount,
                voucherId: created.avhVoucherId,
                voucherNo: pdcNumber.voucherNo,
                voucherRefno: pdcNumber.voucherRefno,
            });
        }
        for (const key of plan.partyCreditByVoucher.keys()) {
            if (!vouchers.some((voucher) => voucher.key === key)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Allocation could not be completed', [
                    {
                        field: 'tenders',
                        message: `The allocation names a voucher "${key}" that has no instrument`,
                    },
                ]);
            }
        }
        return vouchers;
    }
    async takeLeaves(tx, header, tenders, tenderIdByRow, actor) {
        const leaves = new Map();
        for (const tender of tenders.filter((row) => row.isCheque && row.cheque)) {
            const taken = await (0, cheque_book_helper_1.takeNextLeaf)(tx, tender.cheque.chequeBookId, actor);
            if (!taken) {
                (0, module_service_utils_1.throwAccountsConflict)('Cheque book has no leaf to give', [
                    {
                        field: `tenders.${tender.rowNo}.cheque.chequeBookId`,
                        message: `Book ${tender.cheque.bookNo} has no leaf left — start a new book (Cheque Books, menu 263)`,
                    },
                ]);
            }
            leaves.set(tender.rowNo, taken);
            const tenderId = tenderIdByRow.get(tender.rowNo);
            if (tenderId) {
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail
             SET td_ref_no = ${taken.leaf}, td_bank_name = ${tender.cheque.bankName.slice(0, 150)}
           WHERE td_id = ${tenderId}::uuid AND td_acc_year = ${header.avhAccYear}::char(9)`;
            }
        }
        return leaves;
    }
    async writeRegisterRows(tx, params) {
        const written = new Map();
        const now = new Date();
        for (const tender of params.tenders.filter((row) => row.isCheque && row.cheque)) {
            const voucher = tender.isPdc
                ? params.vouchers.get((0, allocation_engine_1.pdcVoucherKey)(tender.rowNo))
                : params.vouchers.get(allocation_engine_1.RECEIPT_VOUCHER_KEY);
            const leaf = params.leaves.get(tender.rowNo);
            const cheque = tender.cheque;
            const created = await tx.accPdcRegister.create({
                data: {
                    apdCompanyId: params.header.avhCompanyId,
                    apdBranchId: params.header.avhBranchId,
                    apdTenantId: params.header.avhTenantId,
                    apdAccYear: voucher.accYear,
                    apdTraType: payment_enum_1.PdcTraType.PAID,
                    apdPartyId: params.header.avhPartyId,
                    apdSalesmanId: params.header.avhEmployeeId[0] ?? null,
                    apdInstrumentType: payment_enum_1.PdcInstrumentType.CHEQUE,
                    apdInstrumentNo: leaf.leaf,
                    apdInstrumentDate: tender.instrumentDate,
                    apdAmount: tender.amount,
                    apdBankName: cheque.bankName,
                    apdBankBranch: cheque.bankBranch,
                    apdIfsc: cheque.ifsc,
                    apdMicr: cheque.micr,
                    apdDrawerName: cheque.drawerName,
                    apdReceivedOn: params.paymentDate,
                    apdBankLedgerId: cheque.bankLedgerId,
                    apdChequeBookId: cheque.chequeBookId,
                    apdFavouring: cheque.favouring,
                    apdAcPayee: cheque.acPayee,
                    apdPostingMode: params.postingMode,
                    apdVoucherId: voucher.voucherId,
                    apdVoucherAccYear: voucher.accYear,
                    apdStatus: payment_enum_1.PdcStatus.HELD,
                    apdStatusOn: now,
                    apdStatusBy: params.actor,
                    apdCreatedBy: params.actor,
                },
                select: { apdId: true, apdAccYear: true },
            });
            written.set(tender.rowNo, created);
        }
        return written;
    }
    async writeLegs(tx, params) {
        const { header, plan, vouchers } = params;
        for (const voucher of vouchers.values()) {
            const rows = [];
            let rowNo = 1;
            const push = (drCr, ledgerId, amount, role, remarks) => {
                if (amount.lessThanOrEqualTo(0)) {
                    return;
                }
                rows.push({
                    avVoucherId: voucher.voucherId,
                    avCompanyId: header.avhCompanyId,
                    avBranchId: header.avhBranchId,
                    avTenantId: header.avhTenantId,
                    avAccYear: voucher.accYear,
                    avVoucherTypeId: header.avhVoucherTypeId,
                    avVoucherNo: voucher.voucherNo,
                    avRowNo: rowNo++,
                    avVoucherDate: voucher.voucherDate,
                    avVoucherRefno: voucher.voucherRefno,
                    avDrCr: drCr,
                    avLedgerId: ledgerId,
                    avAmount: amount,
                    avRole: role,
                    avRemarks: remarks,
                    avSessionId: header.avhSessionId,
                    avUserId: header.avhUserId,
                    avCreatedBy: params.actor,
                });
            };
            push(payment_enum_1.DrCr.DR, header.avhPartyId, plan.partyCreditByVoucher.get(voucher.key) ?? receipt_utils_1.ZERO, null, null);
            if (voucher.tenderRowNo === null) {
                for (const line of params.otherLines) {
                    push(line.drCr, line.ledgerId, line.amount, line.role, line.narration);
                }
                await this.pushReduction(tx, push, params, payment_enum_1.PAYMENT_REDUCTION_ROLE.discount, (bill) => bill.discount);
                await this.pushReduction(tx, push, params, payment_enum_1.PAYMENT_REDUCTION_ROLE.writeoff, (bill) => bill.writeoff);
                await this.pushReduction(tx, push, params, payment_enum_1.PAYMENT_REDUCTION_ROLE.roundoff, (bill) => bill.roundoff);
            }
            const tendersHere = params.tenders.filter((tender) => voucher.tenderRowNo === null ? !tender.isPdc : tender.rowNo === voucher.tenderRowNo);
            for (const tender of tendersHere) {
                push(payment_enum_1.DrCr.CR, tender.clearingLedgerId ?? tender.tenderLedgerId, tender.amount, null, tender.refNo ? `${tender.tenderName} ${tender.refNo}` : tender.tenderName);
            }
            if (rows.length > 0) {
                await tx.accVoucher.createMany({ data: rows });
            }
        }
    }
    async pushReduction(tx, push, params, role, pick) {
        const total = (0, receipt_utils_1.sum)(params.bills.map(pick));
        if (total.lessThanOrEqualTo(0)) {
            return;
        }
        const resolved = await (0, payment_ledger_roles_1.requirePaymentRoleLedgers)(tx, [role], {
            companyId: params.header.avhCompanyId,
            branchId: params.header.avhBranchId,
        });
        const ledger = (0, payment_ledger_roles_1.ledgerForRole)(resolved, role);
        push(payment_enum_1.DrCr.CR, ledger.ledgerId, total, role, null);
    }
    async writeAdjustments(tx, params) {
        const { header, plan } = params;
        const ledgerByLineNo = new Map(params.otherLines.map((line) => [line.lineNo, line.ledgerId]));
        const rowNoByVoucher = new Map();
        const rows = plan.adjustments.map((adjustment) => {
            const voucher = params.vouchers.get(adjustment.voucherKey);
            const rowNo = (rowNoByVoucher.get(adjustment.voucherKey) ?? 0) + 1;
            rowNoByVoucher.set(adjustment.voucherKey, rowNo);
            const register = adjustment.tenderRowNo === null
                ? undefined
                : params.registerByTenderRow.get(adjustment.tenderRowNo);
            return {
                abjCompanyId: header.avhCompanyId,
                abjBranchId: header.avhBranchId,
                abjTenantId: header.avhTenantId,
                abjAccYear: voucher.accYear,
                abjBillId: adjustment.billId,
                abjBillAccYear: adjustment.billAccYear,
                abjPartyId: header.avhPartyId,
                abjRowNo: rowNo,
                abjAgainstBillId: adjustment.againstBill?.billId ?? null,
                abjAgainstBillAccYear: adjustment.againstBill?.billAccYear ?? null,
                abjVoucherId: voucher.voucherId,
                abjVoucherAccYear: voucher.accYear,
                abjAdjType: adjustment.adjType,
                abjAdjDate: adjustment.adjDate,
                abjDrCr: adjustment.drCr,
                abjAmount: adjustment.amount,
                abjSettlementMode: adjustment.settlementMode,
                abjSettlementLedgerId: adjustment.otherLineNo === null
                    ? null
                    : (ledgerByLineNo.get(adjustment.otherLineNo) ?? null),
                abjTenderId: adjustment.tenderRowNo === null
                    ? null
                    : (params.tenderIdByRow.get(adjustment.tenderRowNo) ?? null),
                abjTenderAccYear: adjustment.tenderRowNo === null ? null : header.avhAccYear,
                abjChequeId: register?.apdId ?? null,
                abjChequeAccYear: register?.apdAccYear ?? null,
                abjIsPostDated: adjustment.isPostDated,
                abjApprovedBy: adjustment.approvedBy,
                abjRemarks: adjustment.remarks,
                abjUserId: header.avhUserId,
                abjSessionId: header.avhSessionId,
                abjCreatedBy: params.actor,
            };
        });
        if (rows.length > 0) {
            await tx.accBillAdjustment.createMany({ data: rows });
        }
    }
    async writeAdvanceBills(tx, params) {
        for (const entry of params.plan.onAccount) {
            if (entry.amount.lessThanOrEqualTo(0)) {
                continue;
            }
            const voucher = params.vouchers.get(entry.voucherKey);
            await tx.accBillBalance.create({
                data: {
                    ablCompanyId: params.header.avhCompanyId,
                    ablBranchId: params.header.avhBranchId,
                    ablTenantId: params.header.avhTenantId,
                    ablAccYear: voucher.accYear,
                    ablPartyId: params.header.avhPartyId,
                    ablSalesmanId: params.header.avhEmployeeId[0] ?? null,
                    ablBillType: payment_enum_1.BillType.ADVANCE,
                    ablSrcModule: payment_enum_1.PAYMENT_SRC_MODULE,
                    ablSrcDocType: payment_enum_1.PAYMENT_ADVANCE_SRC_DOC_TYPE,
                    ablSrcDocId: voucher.voucherId,
                    ablSrcAccYear: voucher.accYear,
                    ablVoucherId: voucher.voucherId,
                    ablVoucherTypeId: params.header.avhVoucherTypeId,
                    ablVoucherNo: voucher.voucherNo,
                    ablVoucherDate: voucher.voucherDate,
                    ablVoucherRefno: voucher.voucherRefno,
                    ablDocRefno: voucher.voucherRefno,
                    ablDocDate: voucher.voucherDate,
                    ablDueDate: null,
                    ablDrCr: payment_enum_1.DrCr.DR,
                    ablBillAmount: entry.amount,
                    ablNarration: `Advance paid on payment ${voucher.voucherRefno}`,
                    ablCreatedBy: params.actor,
                },
            });
        }
    }
    async linkInstruments(tx, params) {
        for (const tender of params.tenders) {
            const voucher = tender.isPdc
                ? params.vouchers.get((0, allocation_engine_1.pdcVoucherKey)(tender.rowNo))
                : params.vouchers.get(allocation_engine_1.RECEIPT_VOUCHER_KEY);
            const tenderId = params.tenderIdByRow.get(tender.rowNo);
            if (!tenderId) {
                continue;
            }
            await tx.accTenderDetail.update({
                where: { tdId_tdAccYear: { tdId: tenderId, tdAccYear: params.header.avhAccYear } },
                data: { tdVoucherId: voucher.voucherId },
            });
            const register = params.registerByTenderRow.get(tender.rowNo);
            if (register) {
                await tx.accPdcRegister.update({
                    where: { apdId_apdAccYear: { apdId: register.apdId, apdAccYear: register.apdAccYear } },
                    data: { apdTenderId: tenderId },
                });
            }
        }
    }
    async tenderIdsByRow(tx, voucherId) {
        const rows = await tx.accTenderDetail.findMany({
            where: { tdSrcDocId: voucherId, tdIsDeleted: false },
            select: { tdId: true, tdRowNo: true },
        });
        return new Map(rows.map((row) => [row.tdRowNo, row.tdId]));
    }
    async writeTdsRegister(tx, params) {
        const { header, party, tds } = params;
        const date = (0, receipt_utils_1.toDateString)(header.avhVoucherDate);
        await tx.$executeRaw `
      INSERT INTO accounts.acc_tds_register (
        atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
        atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
        atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
        atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_remarks, atd_created_by
      ) VALUES (
        ${header.avhCompanyId}::uuid, ${header.avhBranchId}::uuid, ${header.avhTenantId}::uuid,
        ${header.avhAccYear}::char(9), ${quarterOf(date)}::bpchar, 'DEDUCTED',
        ${party.ledId}::uuid, ${party.ledPanNo}, ${party.ledName.slice(0, 150)},
        ${tds.registerDeductee}, ${tds.section}, ${tds.rate.toFixed(3)}::numeric,
        ${tds.rateSource}, ${tds.base.toFixed(2)}::numeric, ${tds.tax.toFixed(2)}::numeric,
        ${header.avhVoucherId}::uuid, ${header.avhAccYear}::char(9),
        ${params.refno.slice(0, 50)}, ${date}::date,
        NULL, NULL,
        ${tds.reason?.slice(0, 250) ?? null}, ${params.actor}
      )`;
    }
    async postHeaders(tx, params) {
        const now = new Date();
        for (const voucher of params.vouchers) {
            const totals = await (0, voucher_totals_helper_1.deriveVoucherTotals)(tx, voucher.voucherId, voucher.accYear);
            if (!totals.difference.isZero()) {
                (0, module_service_utils_1.throwAccountsBadRequest)('The voucher does not balance', [
                    {
                        field: 'avhVoucherId',
                        message: `${voucher.voucherRefno} is out by ${totals.difference.toFixed(2)} ` +
                            `(debit ${totals.totalDebit.toFixed(2)}, credit ${totals.totalCredit.toFixed(2)})`,
                    },
                ]);
            }
            const instrumentLedgers = new Set(params.tenders
                .filter((tender) => voucher.tenderRowNo === null ? !tender.isPdc : tender.rowNo === voucher.tenderRowNo)
                .map((tender) => tender.clearingLedgerId ?? tender.tenderLedgerId));
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: { avhVoucherId: voucher.voucherId, avhAccYear: voucher.accYear },
                },
                data: {
                    avhDocAmount: voucher.docAmount,
                    avhAdjustAmount: params.plan.adjustAmountByVoucher.get(voucher.key) ?? receipt_utils_1.ZERO,
                    avhOppositeLedgerId: instrumentLedgers.size === 1 ? [...instrumentLedgers][0] : null,
                    avhRoundOff: receipt_utils_1.ZERO,
                    avhVoucherStatus: payment_enum_1.VoucherStatus.POSTED,
                    avhStatusOn: now,
                    avhStatusBy: params.actor,
                    avhPostedOn: now,
                    avhDraftLines: client_1.Prisma.DbNull,
                    avhModifiedOn: now,
                    avhModifiedBy: params.actor,
                },
            });
        }
    }
    async postDatedHeldByBill(tx, bills) {
        if (bills.length === 0) {
            return new Map();
        }
        const rows = await tx.accBillAdjustment.findMany({
            where: {
                abjIsDeleted: false,
                abjIsPostDated: true,
                abjAdjDate: { gt: (0, receipt_utils_1.todayUtc)() },
                OR: bills.map((bill) => ({ abjBillId: bill.billId, abjBillAccYear: bill.accYear })),
            },
            select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
        });
        const held = new Map();
        for (const row of rows) {
            const key = `${row.abjBillId}|${row.abjBillAccYear}`;
            held.set(key, (held.get(key) ?? receipt_utils_1.ZERO).plus(row.abjAmount));
        }
        return held;
    }
};
exports.PaymentPostingService = PaymentPostingService;
exports.PaymentPostingService = PaymentPostingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        payment_service_1.PaymentService,
        payment_open_items_service_1.PaymentOpenItemsService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], PaymentPostingService);
function rethrowAllocationError(error) {
    if (error instanceof allocation_engine_1.AllocationError) {
        if (error.kind === 'CONFLICT') {
            (0, module_service_utils_1.throwAccountsConflict)(error.message, error.details);
        }
        (0, module_service_utils_1.throwAccountsBadRequest)(error.message, error.details);
    }
    return error;
}
function quarterOf(iso) {
    const m = Number(iso.slice(5, 7));
    if (m >= 4 && m <= 6)
        return 'Q1';
    if (m >= 7 && m <= 9)
        return 'Q2';
    if (m >= 10)
        return 'Q3';
    return 'Q4';
}
function startOfDay(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}
//# sourceMappingURL=payment-posting.service.js.map