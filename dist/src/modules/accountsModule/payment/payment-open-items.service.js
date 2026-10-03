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
exports.PaymentOpenItemsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ppd_slab_1 = require("../receipt/ppd-slab");
const receipt_utils_1 = require("../receipt/receipt.utils");
const payment_guards_1 = require("./payment.guards");
const payment_tds_1 = require("./payment-tds");
const payment_settings_1 = require("./payment.settings");
const payment_enum_1 = require("./types/payment-enum");
let PaymentOpenItemsService = class PaymentOpenItemsService {
    prisma;
    appSettingValueService;
    constructor(prisma, appSettingValueService) {
        this.prisma = prisma;
        this.appSettingValueService = appSettingValueService;
    }
    async listOpenItems(query) {
        const onDate = query.onDate ? (0, receipt_utils_1.toDateOnly)(query.onDate) : (0, receipt_utils_1.todayUtc)();
        const onIso = onDate.toISOString().slice(0, 10);
        const [party, settings] = await Promise.all([
            (0, payment_guards_1.loadPayee)(this.prisma, query.companyId, query.partyId, 'partyId', { allowMoneyLedger: true }),
            this.loadSettings(query.companyId),
        ]);
        const slabs = await this.loadSupplierDiscountTerms(query.partyId);
        const [bills, credits, tds, bank] = await Promise.all([
            this.loadPayables(query.companyId, query.partyId, onDate, settings, slabs),
            this.loadHeldDebits(query.companyId, query.partyId),
            (0, payment_tds_1.loadPaymentTdsFacts)(this.prisma, {
                companyId: query.companyId,
                party,
                accYear: (0, payment_guards_1.accYearOf)(onDate),
                date: onIso,
            }),
            this.loadDefaultBank(query.partyId),
        ]);
        return {
            bills,
            credits,
            summary: {
                totalPending: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(bills.map((bill) => (0, receipt_utils_1.money)(bill.pendingAmount)))),
                billCount: bills.length,
                overdueCount: bills.filter((bill) => bill.daysOverdue > 0).length,
                creditsHeld: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(credits.map((credit) => (0, receipt_utils_1.money)(credit.pendingAmount)))),
                pdcHeld: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(bills.map((bill) => (0, receipt_utils_1.money)(bill.pdcHeld)))),
            },
            party: {
                ledId: party.ledId,
                ledName: party.ledName,
                groupName: party.groupName,
                isBillByBill: party.ledIsBillByBill,
                isMoneyLedger: party.isMoneyLedger,
                isTdsApplicable: party.ledIsTdsApplicable,
                tdsSection: party.ledTdsSection,
                tdsDeducteeType: party.ledTdsDeducteeType,
                tdsRate: tds?.rate ? (0, receipt_utils_1.toAmount)(party.ledPanNo ? tds.rate.rate : tds.rate.noPanRate) : null,
                tdsRateSource: tds?.rate ? (party.ledPanNo ? 'MASTER' : 'NO_PAN') : null,
                tdsThresholdSingle: tds?.rate ? (0, receipt_utils_1.toAmount)(tds.rate.thresholdSingle) : null,
                tdsThresholdAnnual: tds?.rate ? (0, receipt_utils_1.toAmount)(tds.rate.thresholdAnnual) : null,
                tdsPaidThisYear: (0, receipt_utils_1.toAmount)(tds?.annualBaseSoFar ?? receipt_utils_1.ZERO),
                panPresent: party.ledPanNo !== null,
                bank: bank
                    ? { name: bank.lbaBankName, accountNo: bank.lbaAccountNo, ifsc: bank.lbaIfscCode ?? null }
                    : null,
                favouringName: bank?.lbaChequeName?.trim() || bank?.lbaAccountHolder?.trim() || party.ledName,
            },
        };
    }
    async loadSupplierDiscountTerms(partyId) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { supId: partyId, supIsDeleted: false },
            select: { supCreditDays: true, supCashDiscPerc: true },
        });
        const perc = supplier ? supplier.supCashDiscPerc.toNumber() : 0;
        if (!supplier || perc <= 0 || perc >= 100 || supplier.supCreditDays < 0) {
            return [];
        }
        return [{ days: supplier.supCreditDays, perc }];
    }
    async loadPayables(companyId, partyId, onDate, settings, slabs) {
        const bills = await this.prisma.accBillBalance.findMany({
            where: {
                ablCompanyId: companyId,
                ablPartyId: partyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablDrCr: 'CR',
                ablBillType: { in: [...payment_enum_1.PAYABLE_BILL_TYPES] },
                ablPendingAmount: { gt: 0 },
            },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillType: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablDueDate: true,
                ablBillAmount: true,
                ablPendingAmount: true,
                ablStatus: true,
                ablVoucherId: true,
            },
        });
        const keys = bills.map((bill) => ({ billId: bill.ablId, accYear: bill.ablAccYear }));
        const [pdcByBill, usrRefnoByVoucher] = await Promise.all([
            this.loadPostDatedHeld(keys, onDate),
            this.loadSupplierRefnos(bills.map((bill) => bill.ablVoucherId).filter((id) => !!id)),
        ]);
        const rows = bills.map((bill) => {
            const pending = bill.ablPendingAmount ?? receipt_utils_1.ZERO;
            return {
                billId: bill.ablId,
                billAccYear: bill.ablAccYear,
                billType: bill.ablBillType,
                docRefno: bill.ablDocRefno,
                usrRefno: bill.ablVoucherId ? (usrRefnoByVoucher.get(bill.ablVoucherId) ?? null) : null,
                docDate: (0, receipt_utils_1.toDateString)(bill.ablDocDate),
                dueDate: (0, receipt_utils_1.toDateString)(bill.ablDueDate),
                billAmount: (0, receipt_utils_1.toAmount)(bill.ablBillAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(pending),
                status: (bill.ablStatus ?? 'OPEN'),
                daysOverdue: (0, receipt_utils_1.daysOverdue)(bill.ablDueDate, onDate),
                pdcHeld: (0, receipt_utils_1.toAmount)(pdcByBill.get(`${bill.ablId}|${bill.ablAccYear}`) ?? receipt_utils_1.ZERO),
                ppdSuggested: (0, receipt_utils_1.toAmount)((0, ppd_slab_1.suggestPpdDiscount)({
                    docDate: bill.ablDocDate,
                    onDate,
                    pendingAmount: (0, receipt_utils_1.money)(pending),
                    slabs,
                })),
            };
        });
        const sortKeys = new Map(bills.map((bill) => [
            `${bill.ablId}|${bill.ablAccYear}`,
            { due: bill.ablDueDate ?? bill.ablDocDate, doc: bill.ablDocDate },
        ]));
        const byBillDate = settings.billSort === payment_enum_1.ReceiptBillSort.BILL_DATE;
        const primary = (row) => {
            const keys = sortKeys.get(`${row.billId}|${row.billAccYear}`);
            return (byBillDate ? keys.doc : keys.due).getTime();
        };
        rows.sort((left, right) => primary(left) - primary(right) || left.docRefno.localeCompare(right.docRefno));
        return rows;
    }
    async loadSupplierRefnos(voucherIds) {
        if (voucherIds.length === 0) {
            return new Map();
        }
        const headers = await this.prisma.accVoucherHeader.findMany({
            where: { avhVoucherId: { in: [...new Set(voucherIds)] } },
            select: { avhVoucherId: true, avhDocRefno: true },
        });
        return new Map(headers.map((header) => [header.avhVoucherId, header.avhDocRefno]));
    }
    async loadPostDatedHeld(bills, onDate) {
        if (bills.length === 0) {
            return new Map();
        }
        const rows = await this.prisma.accBillAdjustment.findMany({
            where: {
                abjIsDeleted: false,
                abjIsPostDated: true,
                abjAdjDate: { gt: onDate },
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
    async loadHeldDebits(companyId, partyId) {
        const debits = await this.prisma.accBillBalance.findMany({
            where: {
                ablCompanyId: companyId,
                ablPartyId: partyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablDrCr: 'DR',
                ablBillType: { in: [...payment_enum_1.HELD_DEBIT_BILL_TYPES] },
                ablPendingAmount: { gt: 0 },
            },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillType: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablBillAmount: true,
                ablPendingAmount: true,
                ablStatus: true,
                ablDrCr: true,
                ablSrcModule: true,
                ablSrcDocType: true,
                ablSrcDocId: true,
                ablSrcAccYear: true,
                ablNarration: true,
            },
            orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
        });
        return debits.map((debit) => {
            const routing = (0, payment_enum_1.debitRouting)(debit.ablBillType);
            return {
                billId: debit.ablId,
                billAccYear: debit.ablAccYear,
                billType: debit.ablBillType,
                docRefno: debit.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(debit.ablDocDate),
                billAmount: (0, receipt_utils_1.toAmount)(debit.ablBillAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(debit.ablPendingAmount),
                srcModule: debit.ablSrcModule,
                srcDocType: debit.ablSrcDocType,
                srcDocId: debit.ablSrcDocId,
                srcAccYear: debit.ablSrcAccYear,
                narration: debit.ablNarration,
                status: (debit.ablStatus ?? 'OPEN'),
                drCr: debit.ablDrCr,
                adjType: routing.adjType,
                settlementMode: routing.settlementMode,
            };
        });
    }
    async loadDefaultBank(partyId) {
        return this.prisma.accLedgerBankAccount.findFirst({
            where: { lbaLedgerId: partyId, lbaIsDeleted: false, lbaIsActive: true },
            orderBy: [{ lbaIsDefault: 'desc' }],
            select: {
                lbaBankName: true,
                lbaAccountNo: true,
                lbaIfscCode: true,
                lbaChequeName: true,
                lbaAccountHolder: true,
            },
        });
    }
    async partyContext(query) {
        const party = await (0, payment_guards_1.loadPayee)(this.prisma, query.companyId, query.partyId, 'partyId', {
            allowMoneyLedger: true,
        });
        const [payments, cheques, summary] = await Promise.all([
            this.loadRecentPayments(query.companyId, query.partyId),
            this.loadChequesOut(query.companyId, query.partyId),
            this.loadPartySummary(query.companyId, query.partyId),
        ]);
        return {
            partyId: query.partyId,
            partyName: party.ledName,
            summary,
            lastPayments: payments,
            ourChequesOut: cheques,
        };
    }
    async loadPartySummary(companyId, partyId) {
        const [sides, postDated] = await Promise.all([
            this.prisma.accBillBalance.groupBy({
                by: ['ablDrCr'],
                where: {
                    ablCompanyId: companyId,
                    ablPartyId: partyId,
                    ablIsDeleted: false,
                    ablIsActive: true,
                },
                _sum: { ablPendingAmount: true },
            }),
            this.prisma.accBillAdjustment.aggregate({
                where: {
                    abjCompanyId: companyId,
                    abjPartyId: partyId,
                    abjIsDeleted: false,
                    abjIsPostDated: true,
                    abjDrCr: 'DR',
                    abjAdjDate: { gt: (0, receipt_utils_1.todayUtc)() },
                },
                _sum: { abjAmount: true },
            }),
        ]);
        const bySide = new Map(sides.map((row) => [row.ablDrCr, row._sum.ablPendingAmount ?? receipt_utils_1.ZERO]));
        const outstanding = bySide.get('CR') ?? receipt_utils_1.ZERO;
        const debits = bySide.get('DR') ?? receipt_utils_1.ZERO;
        return {
            totalBalance: (0, receipt_utils_1.toAmount)(outstanding.minus(debits)),
            totalOutstanding: (0, receipt_utils_1.toAmount)(outstanding),
            totalCredits: (0, receipt_utils_1.toAmount)(debits),
            chequesOutstanding: (0, receipt_utils_1.toAmount)(postDated._sum.abjAmount ?? receipt_utils_1.ZERO),
        };
    }
    async loadRecentPayments(companyId, partyId) {
        const headers = await this.prisma.accVoucherHeader.findMany({
            where: {
                avhCompanyId: companyId,
                avhPartyId: partyId,
                avhIsDeleted: false,
                avhVoucherStatus: 'POSTED',
                voucherType: { vchrTypeCode: payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE },
                avhAgainstVoucherId: null,
            },
            select: {
                avhVoucherId: true,
                avhAccYear: true,
                avhVoucherRefno: true,
                avhVoucherDate: true,
                avhDocAmount: true,
                avhAdjustAmount: true,
            },
            orderBy: [{ avhVoucherDate: 'desc' }, { avhVoucherSlno: 'desc' }],
            take: 10,
        });
        if (headers.length === 0) {
            return [];
        }
        const tenders = await this.prisma.accTenderDetail.findMany({
            where: {
                tdSrcDocId: { in: headers.map((header) => header.avhVoucherId) },
                tdIsDeleted: false,
            },
            select: { tdSrcDocId: true, tenderType: { select: { ttmDisplayName: true } } },
        });
        const instrumentsByVoucher = new Map();
        for (const tender of tenders) {
            const name = tender.tenderType?.ttmDisplayName;
            if (!name) {
                continue;
            }
            const set = instrumentsByVoucher.get(tender.tdSrcDocId) ?? new Set();
            set.add(name);
            instrumentsByVoucher.set(tender.tdSrcDocId, set);
        }
        return headers.map((header) => ({
            voucherId: header.avhVoucherId,
            accYear: header.avhAccYear,
            voucherRefno: header.avhVoucherRefno,
            voucherDate: (0, receipt_utils_1.toDateString)(header.avhVoucherDate),
            docAmount: (0, receipt_utils_1.toAmount)(header.avhDocAmount),
            adjustAmount: (0, receipt_utils_1.toAmount)(header.avhAdjustAmount),
            instruments: [...(instrumentsByVoucher.get(header.avhVoucherId) ?? [])].sort().join(', ') || null,
        }));
    }
    async loadChequesOut(companyId, partyId) {
        const rows = await this.prisma.$queryRaw `
      SELECT p.apd_id, p.apd_acc_year, p.apd_instrument_no, p.apd_instrument_date, p.apd_amount,
             p.apd_bank_name, b.acb_book_no, p.apd_status, p.apd_voucher_id, h.avh_voucher_refno
        FROM accounts.acc_pdc_register p
        LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
       WHERE p.apd_company_id = ${companyId}::uuid
         AND p.apd_party_id   = ${partyId}::uuid
         AND p.apd_tra_type   = ${payment_enum_1.PdcTraType.PAID}
         AND p.apd_is_deleted = false
         AND p.apd_status     = 'HELD'
       ORDER BY p.apd_instrument_date, p.apd_instrument_no`;
        return rows.map((row) => ({
            pdcId: row.apd_id,
            accYear: row.apd_acc_year.trim(),
            instrumentNo: row.apd_instrument_no,
            instrumentDate: (0, receipt_utils_1.toDateString)(row.apd_instrument_date),
            amount: (0, receipt_utils_1.toAmount)(row.apd_amount),
            bankName: row.apd_bank_name,
            bookNo: row.acb_book_no,
            status: row.apd_status,
            voucherId: row.apd_voucher_id,
            voucherRefno: row.avh_voucher_refno,
        }));
    }
    async adjacent(query) {
        const current = await this.prisma.accVoucherHeader.findFirst({
            where: {
                avhVoucherId: query.voucherId,
                avhAccYear: query.accYear,
                avhCompanyId: query.companyId,
                avhBranchId: query.branchId,
                avhIsDeleted: false,
                voucherType: { vchrTypeCode: payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE },
            },
            select: { avhVoucherDate: true, avhVoucherSlno: true, avhCreatedOn: true },
        });
        if (!current) {
            (0, module_service_utils_1.throwAccountsNotFound)('Payment not found', 'voucherId', `No payment ${query.voucherId} in ${query.accYear} for this company and branch`);
        }
        const isPrev = query.direction === 'prev';
        const comparison = client_1.Prisma.raw(isPrev ? '<' : '>');
        const order = client_1.Prisma.raw(isPrev ? 'DESC' : 'ASC');
        const status = query.status ?? null;
        const fromDate = query.fromDate ? query.fromDate.slice(0, 10) : null;
        const toDate = query.toDate ? query.toDate.slice(0, 10) : null;
        const currentDate = (0, receipt_utils_1.toDateString)(current.avhVoucherDate);
        const rows = await this.prisma.$queryRaw `
      SELECT h.avh_voucher_id, h.avh_acc_year, h.avh_company_id, h.avh_branch_id,
             h.avh_voucher_refno, h.avh_voucher_date, h.avh_party_id, p.led_name,
             h.avh_doc_amount, h.avh_voucher_status
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
       WHERE h.avh_company_id = ${query.companyId}::uuid
         AND h.avh_branch_id  = ${query.branchId}::uuid
         AND h.avh_acc_year   = ${query.accYear}::bpchar
         AND vt.vchr_type_code = ${payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE}
         AND h.avh_is_deleted = false
         AND h.avh_against_voucher_id IS NULL
         AND (${status}::varchar IS NULL OR h.avh_voucher_status = ${status}::varchar)
         AND (${fromDate}::date IS NULL OR h.avh_voucher_date >= ${fromDate}::date)
         AND (${toDate}::date   IS NULL OR h.avh_voucher_date <= ${toDate}::date)
         AND (h.avh_voucher_date,
              COALESCE(h.avh_voucher_slno, ${DRAFT_SLNO_SENTINEL}),
              h.avh_created_on,
              h.avh_voucher_id)
             ${comparison}
             (${currentDate}::date,
              COALESCE(${current.avhVoucherSlno}::bigint, ${DRAFT_SLNO_SENTINEL}),
              ${current.avhCreatedOn}::timestamptz,
              ${query.voucherId}::uuid)
       ORDER BY h.avh_voucher_date ${order},
                COALESCE(h.avh_voucher_slno, ${DRAFT_SLNO_SENTINEL}) ${order},
                h.avh_created_on ${order},
                h.avh_voucher_id ${order}
       LIMIT 1`;
        const row = rows[0];
        return {
            direction: query.direction,
            fromVoucherId: query.voucherId,
            voucher: row ? toAdjacentVoucher(row) : null,
        };
    }
    async duplicateCheck(query) {
        await (0, payment_guards_1.loadPayee)(this.prisma, query.companyId, query.partyId, 'partyId', {
            allowMoneyLedger: true,
        });
        const matches = await this.prisma.accVoucherHeader.findMany({
            where: {
                avhCompanyId: query.companyId,
                avhAccYear: query.accYear,
                avhPartyId: query.partyId,
                ...(query.branchId ? { avhBranchId: query.branchId } : {}),
                avhVoucherDate: (0, receipt_utils_1.toDateOnly)(query.voucherDate),
                avhDocAmount: (0, receipt_utils_1.money)(query.amount),
                avhIsDeleted: false,
                avhVoucherStatus: { not: payment_enum_1.VoucherStatus.CANCELLED },
                avhAgainstVoucherId: null,
                voucherType: { vchrTypeCode: payment_enum_1.PAYMENT_VOUCHER_TYPE_CODE },
                ...(query.excludeVoucherId ? { avhVoucherId: { not: query.excludeVoucherId } } : {}),
            },
            select: {
                avhVoucherId: true,
                avhAccYear: true,
                avhBranchId: true,
                avhVoucherRefno: true,
                avhVoucherDate: true,
                avhDocAmount: true,
                avhVoucherStatus: true,
                avhCreatedBy: true,
                avhCreatedOn: true,
            },
            orderBy: [{ avhCreatedOn: 'desc' }],
            take: 10,
        });
        const rows = matches.map((match) => ({
            voucherId: match.avhVoucherId,
            accYear: match.avhAccYear,
            branchId: match.avhBranchId,
            voucherRefno: match.avhVoucherRefno,
            voucherDate: (0, receipt_utils_1.toDateString)(match.avhVoucherDate),
            docAmount: (0, receipt_utils_1.toAmount)(match.avhDocAmount),
            status: match.avhVoucherStatus,
            createdBy: match.avhCreatedBy,
            createdOn: (0, receipt_utils_1.toIsoString)(match.avhCreatedOn),
        }));
        return { isDuplicate: rows.length > 0, matches: rows };
    }
    async loadSettings(companyId, branchId) {
        const effective = await this.appSettingValueService.resolveEffective({
            companyId,
            branchId: branchId ?? undefined,
        });
        return (0, payment_settings_1.readPaymentSettings)(effective);
    }
};
exports.PaymentOpenItemsService = PaymentOpenItemsService;
exports.PaymentOpenItemsService = PaymentOpenItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_setting_value_service_1.AppSettingValueService])
], PaymentOpenItemsService);
const DRAFT_SLNO_SENTINEL = 9223372036854775807n;
function toAdjacentVoucher(row) {
    return {
        voucherId: row.avh_voucher_id,
        accYear: row.avh_acc_year,
        companyId: row.avh_company_id,
        branchId: row.avh_branch_id,
        voucherRefno: row.avh_voucher_refno,
        voucherDate: (0, receipt_utils_1.toDateString)(row.avh_voucher_date),
        partyId: row.avh_party_id,
        partyName: row.led_name,
        docAmount: (0, receipt_utils_1.toAmount)(row.avh_doc_amount),
        status: row.avh_voucher_status,
    };
}
//# sourceMappingURL=payment-open-items.service.js.map