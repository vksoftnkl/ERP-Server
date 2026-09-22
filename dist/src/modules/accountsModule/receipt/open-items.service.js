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
exports.OpenItemsService = void 0;
exports.creditRouting = creditRouting;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const receipt_enum_1 = require("./types/receipt-enum");
const receipt_guards_1 = require("./receipt.guards");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_settings_1 = require("./receipt.settings");
const ppd_slab_1 = require("./ppd-slab");
const receipt_utils_1 = require("./receipt.utils");
let OpenItemsService = class OpenItemsService {
    prisma;
    appSettingValueService;
    constructor(prisma, appSettingValueService) {
        this.prisma = prisma;
        this.appSettingValueService = appSettingValueService;
    }
    async listOpenItems(query) {
        const partyId = query.partyId;
        const onDate = query.onDate ? (0, receipt_utils_1.toDateOnly)(query.onDate) : (0, receipt_utils_1.todayUtc)();
        const [party, settings] = await Promise.all([
            (0, receipt_guards_1.loadParty)(this.prisma, query.companyId, partyId, 'partyId'),
            this.loadSettings(query.companyId),
        ]);
        const [loadedBills, credits] = await Promise.all([
            this.loadBills(query.companyId, partyId, onDate, settings),
            this.loadCredits(query.companyId, partyId),
        ]);
        const bills = await this.attachTempCredits(loadedBills, query.mobile?.trim() || null);
        const partyPayload = {
            ledId: party.ledId,
            ledName: party.ledName,
            groupName: party.groupName,
            isBillByBill: party.ledIsBillByBill,
            isTdsApplicable: party.ledIsTdsApplicable,
            tdsDeducteeType: party.ledTdsDeducteeType,
            isTcsApplicable: party.ledIsTcsApplicable,
            tcsBasis: settings.tcsBasis,
            tanNo: party.ledTanNo,
        };
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
            party: partyPayload,
        };
    }
    async attachTempCredits(bills, mobile) {
        if (bills.length === 0) {
            return bills;
        }
        const rows = await this.prisma.$queryRaw `
      SELECT atc_id, atc_abl_id, atc_abl_acc_year, atc_name, atc_mobile, atc_due_date, atc_balance_amount, atc_status
        FROM accounts.acc_temp_credit
       WHERE atc_is_deleted = false AND atc_status <> 'CANCELLED'
         AND (atc_abl_id, atc_abl_acc_year) IN (${client_1.Prisma.join(bills.map((b) => client_1.Prisma.sql `(${b.billId}::uuid, ${b.billAccYear}::char(9))`))})`;
        const by = new Map(rows.map((r) => [`${r.atc_abl_id}|${r.atc_abl_acc_year.trim()}`, r]));
        const out = bills.map((b) => {
            const r = by.get(`${b.billId}|${b.billAccYear.trim()}`);
            return {
                ...b,
                tempCredit: r
                    ? {
                        atcId: r.atc_id,
                        name: r.atc_name,
                        mobile: r.atc_mobile,
                        dueDate: r.atc_due_date ? r.atc_due_date.toISOString().slice(0, 10) : null,
                        balance: Number(r.atc_balance_amount.toString()),
                        status: r.atc_status,
                    }
                    : null,
            };
        });
        return mobile ? out.filter((b) => b.tempCredit?.mobile === mobile) : out;
    }
    async loadBills(companyId, partyId, onDate, settings) {
        const bills = await this.prisma.accBillBalance.findMany({
            where: {
                ablCompanyId: companyId,
                ablPartyId: partyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablDrCr: 'DR',
                ablBillType: { in: [...receipt_enum_1.RECEIVABLE_BILL_TYPES] },
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
                ablSrcModule: true,
                ablSrcDocType: true,
                ablSrcDocId: true,
                ablSrcAccYear: true,
            },
        });
        const billKeys = bills.map((bill) => ({ billId: bill.ablId, accYear: bill.ablAccYear }));
        const [pdcByBill, tcsByBill, sourceByBill] = await Promise.all([
            this.loadPostDatedHeld(billKeys, onDate),
            this.loadBillTcs(billKeys, settings),
            this.loadSourceBillFacts(bills),
        ]);
        const rows = bills.map((bill) => {
            const pending = bill.ablPendingAmount ?? receipt_utils_1.ZERO;
            const source = sourceByBill.get(`${bill.ablId}|${bill.ablAccYear}`);
            return {
                billId: bill.ablId,
                billAccYear: bill.ablAccYear,
                billType: bill.ablBillType,
                docRefno: bill.ablDocRefno,
                usrRefno: source?.usrRefno ?? null,
                billProfit: (0, receipt_utils_1.toNullableAmount)(source?.profit ?? null),
                billProfitPreTax: (0, receipt_utils_1.toNullableAmount)(source?.profitPreTax ?? null),
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
                    slabs: settings.ppdSlabs,
                })),
                tcsAmount: (0, receipt_utils_1.toAmount)(tcsByBill.get(`${bill.ablId}|${bill.ablAccYear}`)?.amount ?? receipt_utils_1.ZERO),
                tcsPending: (0, receipt_utils_1.toAmount)(tcsByBill.get(`${bill.ablId}|${bill.ablAccYear}`)?.pending ?? receipt_utils_1.ZERO),
            };
        });
        const sortKeys = new Map(bills.map((bill) => [
            `${bill.ablId}|${bill.ablAccYear}`,
            { due: bill.ablDueDate ?? bill.ablDocDate, doc: bill.ablDocDate },
        ]));
        const byBillDate = settings.billSort === receipt_enum_1.ReceiptBillSort.BILL_DATE;
        const primary = (row) => {
            const keys = sortKeys.get(`${row.billId}|${row.billAccYear}`);
            return (byBillDate ? keys.doc : keys.due).getTime();
        };
        rows.sort((left, right) => primary(left) - primary(right) || left.docRefno.localeCompare(right.docRefno));
        return rows;
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
    async loadSourceBillFacts(bills) {
        const sourced = bills.filter((bill) => bill.ablSrcModule === SALE_BILL_SRC_MODULE &&
            bill.ablSrcDocType === SALE_BILL_SRC_DOC_TYPE &&
            bill.ablSrcDocId !== null &&
            bill.ablSrcAccYear !== null);
        if (sourced.length === 0) {
            return new Map();
        }
        const sourceKeys = new Map();
        for (const bill of sourced) {
            sourceKeys.set(`${bill.ablSrcDocId}|${bill.ablSrcAccYear}`, {
                docId: bill.ablSrcDocId,
                accYear: bill.ablSrcAccYear,
            });
        }
        const keys = [...sourceKeys.values()];
        const [saleBills, items] = await Promise.all([
            this.prisma.saleBill.findMany({
                where: { OR: keys.map((key) => ({ sbId: key.docId, sbAccYear: key.accYear })) },
                select: { sbId: true, sbAccYear: true, sbUsrRefno: true },
            }),
            this.prisma.saleBillItem.findMany({
                where: {
                    sbiIsDeleted: false,
                    OR: keys.map((key) => ({ sbiBillId: key.docId, sbiAccYear: key.accYear })),
                },
                select: {
                    sbiBillId: true,
                    sbiAccYear: true,
                    sbiNetQty: true,
                    sbiItemProfit: true,
                    sbiProfitPreTax: true,
                },
            }),
        ]);
        const refnoBySource = new Map();
        for (const bill of saleBills) {
            refnoBySource.set(`${bill.sbId}|${bill.sbAccYear}`, bill.sbUsrRefno);
        }
        const marginBySource = new Map();
        for (const item of items) {
            const key = `${item.sbiBillId}|${item.sbiAccYear}`;
            const margin = marginBySource.get(key) ?? {
                profit: receipt_utils_1.ZERO,
                profitPreTax: receipt_utils_1.ZERO,
                profitComplete: true,
                profitPreTaxComplete: true,
            };
            if (item.sbiItemProfit === null) {
                margin.profitComplete = false;
            }
            else {
                margin.profit = margin.profit.plus(item.sbiItemProfit.times(item.sbiNetQty));
            }
            if (item.sbiProfitPreTax === null) {
                margin.profitPreTaxComplete = false;
            }
            else {
                margin.profitPreTax = margin.profitPreTax.plus(item.sbiProfitPreTax.times(item.sbiNetQty));
            }
            marginBySource.set(key, margin);
        }
        const facts = new Map();
        for (const bill of sourced) {
            const sourceKey = `${bill.ablSrcDocId}|${bill.ablSrcAccYear}`;
            const margin = marginBySource.get(sourceKey);
            facts.set(`${bill.ablId}|${bill.ablAccYear}`, {
                usrRefno: refnoBySource.get(sourceKey) ?? null,
                profit: margin && margin.profitComplete ? margin.profit.toDecimalPlaces(2) : null,
                profitPreTax: margin && margin.profitPreTaxComplete ? margin.profitPreTax.toDecimalPlaces(2) : null,
            });
        }
        return facts;
    }
    async loadBillTcs(bills, settings) {
        if (bills.length === 0 || settings.tcsBasis !== receipt_enum_1.TcsBasis.SALES) {
            return new Map();
        }
        const rows = await this.prisma.$queryRaw `
      SELECT v.bill_id, v.bill_acc_year, v.abl_tcs_amount, v.tcs_pending
        FROM accounts.v_bill_tcs v
        JOIN unnest(${bills.map((bill) => bill.billId)}::uuid[],
                    ${bills.map((bill) => bill.accYear)}::bpchar[]) AS k(bill_id, acc_year)
          ON k.bill_id = v.bill_id AND k.acc_year = v.bill_acc_year
       WHERE v.abl_tcs_amount > 0`;
        const tcs = new Map();
        for (const row of rows) {
            tcs.set(`${row.bill_id}|${row.bill_acc_year}`, {
                amount: row.abl_tcs_amount,
                pending: row.tcs_pending,
            });
        }
        return tcs;
    }
    async loadCredits(companyId, partyId, side = 'CR') {
        const credits = await this.prisma.accBillBalance.findMany({
            where: {
                ablCompanyId: companyId,
                ablPartyId: partyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablDrCr: side,
                ablBillType: { in: [...receipt_enum_1.CREDIT_BILL_TYPES] },
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
        return credits.map((credit) => {
            const routing = creditRouting(credit.ablBillType);
            return {
                billId: credit.ablId,
                billAccYear: credit.ablAccYear,
                billType: credit.ablBillType,
                docRefno: credit.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(credit.ablDocDate),
                billAmount: (0, receipt_utils_1.toAmount)(credit.ablBillAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(credit.ablPendingAmount),
                srcModule: credit.ablSrcModule,
                srcDocType: credit.ablSrcDocType,
                srcDocId: credit.ablSrcDocId,
                srcAccYear: credit.ablSrcAccYear,
                narration: credit.ablNarration,
                status: (credit.ablStatus ?? 'OPEN'),
                drCr: credit.ablDrCr,
                adjType: routing.adjType,
                settlementMode: routing.settlementMode,
            };
        });
    }
    async partyContext(query) {
        const party = await (0, receipt_guards_1.loadParty)(this.prisma, query.companyId, query.partyId, 'partyId');
        const [receipts, cheques, summary] = await Promise.all([
            this.loadRecentReceipts(query.companyId, query.partyId),
            this.loadPendingCheques(query.companyId, query.partyId),
            this.loadPartySummary(query.companyId, query.partyId),
        ]);
        return {
            partyId: query.partyId,
            partyName: party.ledName,
            summary,
            lastReceipts: receipts,
            pendingCheques: cheques,
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
                    abjAdjDate: { gt: (0, receipt_utils_1.todayUtc)() },
                },
                _sum: { abjAmount: true },
            }),
        ]);
        const bySide = new Map(sides.map((row) => [row.ablDrCr, row._sum.ablPendingAmount ?? receipt_utils_1.ZERO]));
        const outstanding = bySide.get('DR') ?? receipt_utils_1.ZERO;
        const credits = bySide.get('CR') ?? receipt_utils_1.ZERO;
        return {
            totalBalance: (0, receipt_utils_1.toAmount)(outstanding.minus(credits)),
            totalOutstanding: (0, receipt_utils_1.toAmount)(outstanding),
            totalCredits: (0, receipt_utils_1.toAmount)(credits),
            chequesOutstanding: (0, receipt_utils_1.toAmount)(postDated._sum.abjAmount ?? receipt_utils_1.ZERO),
        };
    }
    async loadRecentReceipts(companyId, partyId) {
        const headers = await this.prisma.accVoucherHeader.findMany({
            where: {
                avhCompanyId: companyId,
                avhPartyId: partyId,
                avhIsDeleted: false,
                avhVoucherStatus: 'POSTED',
                voucherType: { vchrTypeCode: receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE },
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
    async loadPendingCheques(companyId, partyId) {
        const cheques = await this.prisma.accPdcRegister.findMany({
            where: {
                apdCompanyId: companyId,
                apdPartyId: partyId,
                apdIsDeleted: false,
                apdStatus: { in: ['HELD', 'DEPOSITED'] },
            },
            select: {
                apdId: true,
                apdAccYear: true,
                apdInstrumentNo: true,
                apdInstrumentDate: true,
                apdAmount: true,
                apdBankName: true,
                apdStatus: true,
                apdVoucherId: true,
                receiptVoucher: { select: { avhVoucherRefno: true } },
            },
            orderBy: [{ apdInstrumentDate: 'asc' }, { apdInstrumentNo: 'asc' }],
        });
        return cheques.map((cheque) => ({
            pdcId: cheque.apdId,
            accYear: cheque.apdAccYear,
            instrumentNo: cheque.apdInstrumentNo,
            instrumentDate: (0, receipt_utils_1.toDateString)(cheque.apdInstrumentDate),
            amount: (0, receipt_utils_1.toAmount)(cheque.apdAmount),
            bankName: cheque.apdBankName,
            status: cheque.apdStatus,
            voucherId: cheque.apdVoucherId,
            voucherRefno: cheque.receiptVoucher?.avhVoucherRefno ?? null,
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
            },
            select: { avhVoucherDate: true, avhVoucherSlno: true, avhCreatedOn: true },
        });
        if (!current) {
            (0, module_service_utils_1.throwAccountsNotFound)('Receipt not found', 'voucherId', `No receipt ${query.voucherId} in ${query.accYear} for this company and branch`);
        }
        const isPrev = query.direction === 'prev';
        const comparison = client_1.Prisma.raw(isPrev ? '<' : '>');
        const order = client_1.Prisma.raw(isPrev ? 'DESC' : 'ASC');
        const status = query.status ?? null;
        const fromDate = query.fromDate ? (0, receipt_utils_1.toDateOnly)(query.fromDate) : null;
        const toDate = query.toDate ? (0, receipt_utils_1.toDateOnly)(query.toDate) : null;
        const rows = await this.prisma.$queryRaw `
      SELECT h.avh_voucher_id,
             h.avh_acc_year,
             h.avh_company_id,
             h.avh_branch_id,
             h.avh_voucher_refno,
             h.avh_voucher_date,
             h.avh_party_id,
             p.led_name,
             h.avh_doc_amount,
             h.avh_voucher_status
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
       WHERE h.avh_company_id = ${query.companyId}::uuid
         AND h.avh_branch_id  = ${query.branchId}::uuid
         AND h.avh_acc_year   = ${query.accYear}::bpchar
         AND vt.vchr_type_code = ${receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE}
         AND h.avh_is_deleted = false
         AND h.avh_against_voucher_id IS NULL
         AND (${status}::varchar IS NULL OR h.avh_voucher_status = ${status}::varchar)
         AND (${fromDate}::timestamptz IS NULL OR h.avh_voucher_date >= ${fromDate}::timestamptz)
         AND (${toDate}::timestamptz   IS NULL OR h.avh_voucher_date <= ${toDate}::timestamptz)
         AND (h.avh_voucher_date,
              COALESCE(h.avh_voucher_slno, ${DRAFT_SLNO_SENTINEL}),
              h.avh_created_on,
              h.avh_voucher_id)
             ${comparison}
             (${current.avhVoucherDate}::timestamptz,
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
        await (0, receipt_guards_1.loadParty)(this.prisma, query.companyId, query.partyId, 'partyId');
        const matches = await this.prisma.accVoucherHeader.findMany({
            where: {
                avhCompanyId: query.companyId,
                avhAccYear: query.accYear,
                avhPartyId: query.partyId,
                ...(query.branchId ? { avhBranchId: query.branchId } : {}),
                avhVoucherDate: (0, receipt_utils_1.toDateOnly)(query.voucherDate),
                avhDocAmount: (0, receipt_utils_1.money)(query.amount),
                avhIsDeleted: false,
                avhVoucherStatus: { not: receipt_enum_1.VoucherStatus.CANCELLED },
                avhAgainstVoucherId: null,
                voucherType: { vchrTypeCode: receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE },
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
        return (0, receipt_settings_1.readReceiptSettings)(effective);
    }
};
exports.OpenItemsService = OpenItemsService;
exports.OpenItemsService = OpenItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_setting_value_service_1.AppSettingValueService])
], OpenItemsService);
function creditRouting(billType) {
    return billType === receipt_enum_1.BillType.SALES_RETURN
        ? { adjType: receipt_enum_1.BillAdjType.NOTE_ADJUST, settlementMode: receipt_enum_1.BillSettlementMode.CREDIT_NOTE }
        : { adjType: receipt_enum_1.BillAdjType.ADVANCE_ADJUST, settlementMode: receipt_enum_1.BillSettlementMode.ADVANCE };
}
const SALE_BILL_SRC_MODULE = 'SALES';
const SALE_BILL_SRC_DOC_TYPE = 'BILL';
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
//# sourceMappingURL=open-items.service.js.map