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
exports.MobileReceiptService = exports.MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES = void 0;
exports.receiptDayOf = receiptDayOf;
exports.phonePlanOf = phonePlanOf;
exports.settlementOf = settlementOf;
exports.creditKindOf = creditKindOf;
exports.mergeByParty = mergeByParty;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const rights_1 = require("../../common/posting/rights");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const open_items_service_1 = require("../../modules/accountsModule/receipt/open-items.service");
const receipt_guards_1 = require("../../modules/accountsModule/receipt/receipt.guards");
const receipt_utils_1 = require("../../modules/accountsModule/receipt/receipt.utils");
const receipt_service_1 = require("../../modules/accountsModule/receipt/receipt.service");
const receipt_posting_service_1 = require("../../modules/accountsModule/receipt/receipt-posting.service");
const receipt_enum_1 = require("../../modules/accountsModule/receipt/types/receipt-enum");
const acc_error_codes_1 = require("../../modules/accountsModule/receipt/types/acc-error-codes");
const vouchers_errors_1 = require("../../modules/accountsModule/vouchers/vouchers.errors");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_login_1 = require("../common/mobile-login");
const mobile_scope_1 = require("../common/mobile-scope");
const mobile_item_service_1 = require("../item/mobile-item.service");
const mobile_receipt_dto_1 = require("./dto/mobile-receipt.dto");
const mobile_receipt_settlement_1 = require("./mobile-receipt-settlement");
const mobile_receipt_plan_1 = require("./mobile-receipt-plan");
const mobile_receipt_ppd_1 = require("./mobile-receipt-ppd");
exports.MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES = [
    'ADJUST',
    'RRN',
    'CREDIT',
    'LOYALTY',
    'TEMP_CR',
];
const ZERO = new client_1.Prisma.Decimal(0);
const NOTHING_SETTLED = {
    allocations: [],
    creditsApplied: [],
    pdcVouchers: [],
    onAccount: '0.00',
    figures: { bills: new Map(), credits: new Map() },
};
function receiptDayOf(avhVoucherDate, today) {
    return avhVoucherDate ? avhVoucherDate.slice(0, 10) : today;
}
function phonePlanOf(dto) {
    if (dto.allocations === undefined && dto.creditsApplied === undefined) {
        return null;
    }
    const lines = (dto.allocations ?? []).map((row) => ({
        billId: row.billId,
        billAccYear: row.billAccYear.trim(),
        amount: (0, receipt_utils_1.money)(row.amount),
        discount: (0, receipt_utils_1.money)(row.discount ?? 0),
        roundoff: (0, receipt_utils_1.money)(row.roundoff ?? 0),
    }));
    const credits = (dto.creditsApplied ?? []).map((row) => ({
        billId: row.billId,
        billAccYear: row.billAccYear.trim(),
        amount: (0, receipt_utils_1.money)(row.amount),
    }));
    const refuseRepeat = (rows, field) => {
        const seen = new Set();
        rows.forEach((row, index) => {
            const key = (0, mobile_receipt_plan_1.billKeyOf)(row);
            if (seen.has(key)) {
                (0, module_shared_utils_1.throwBadRequest)('Validation failed', [
                    {
                        field: `${field}.${index}.billId`,
                        code: acc_error_codes_1.ACC.INVALID,
                        message: `${row.billId} appears twice. Send one row per ` +
                            `${field === 'allocations' ? 'bill' : 'credit'} with the total.`,
                    },
                ]);
            }
            seen.add(key);
        });
    };
    refuseRepeat(lines, 'allocations');
    refuseRepeat(credits, 'creditsApplied');
    return { lines, credits, fillAll: dto.allocations === undefined };
}
function settlementOf(payload) {
    const live = (row) => !row.isReversed && row.reversalOfId === null;
    const bills = new Map();
    const billOf = (row) => {
        const key = (0, mobile_receipt_plan_1.billKeyOf)(row);
        const entry = bills.get(key) ?? { row, amount: ZERO, discount: ZERO, roundoff: ZERO };
        bills.set(key, entry);
        return entry;
    };
    for (const row of payload.allocations) {
        if (row.againstBillId !== null || !live(row)) {
            continue;
        }
        const entry = billOf(row);
        if (row.adjType === receipt_enum_1.BillAdjType.DISCOUNT) {
            entry.discount = entry.discount.plus(row.amount);
        }
        else if (row.adjType === receipt_enum_1.BillAdjType.ROUND_OFF) {
            entry.roundoff = entry.roundoff.plus(row.amount);
        }
        else if (row.adjType !== receipt_enum_1.BillAdjType.WRITEOFF) {
            entry.amount = entry.amount.plus(row.amount);
        }
    }
    const credits = new Map();
    for (const row of payload.creditsApplied) {
        if (row.againstBillId === null || !live(row)) {
            continue;
        }
        if (row.drCr === receipt_enum_1.DrCr.CR) {
            const entry = billOf(row);
            entry.amount = entry.amount.plus(row.amount);
            continue;
        }
        const key = (0, mobile_receipt_plan_1.billKeyOf)(row);
        const entry = credits.get(key) ?? { row, amount: ZERO };
        entry.amount = entry.amount.plus(row.amount);
        credits.set(key, entry);
    }
    const onAccount = payload.advanceBills.reduce((total, bill) => total.plus(bill.billAmount), new client_1.Prisma.Decimal(0));
    return {
        allocations: [...bills.values()].map((entry) => ({
            billId: entry.row.billId,
            billAccYear: entry.row.billAccYear.trim(),
            docRefno: entry.row.docRefno,
            amount: (0, mobile_item_service_1.moneyText)(entry.amount),
            discount: (0, mobile_item_service_1.moneyText)(entry.discount),
            roundoff: (0, mobile_item_service_1.moneyText)(entry.roundoff),
            pendingAmount: (0, mobile_item_service_1.moneyText)(entry.row.pendingAmount),
        })),
        creditsApplied: [...credits.values()].map((entry) => ({
            billId: entry.row.billId,
            billAccYear: entry.row.billAccYear.trim(),
            docRefno: entry.row.docRefno,
            amount: (0, mobile_item_service_1.moneyText)(entry.amount),
            pendingAmount: (0, mobile_item_service_1.moneyText)(entry.row.pendingAmount),
        })),
        pdcVouchers: (payload.pdcVouchers ?? []).map((pdc) => ({
            voucherId: pdc.voucherId,
            voucherRefno: pdc.voucherRefno,
            chequeDate: pdc.voucherDate,
            amount: (0, mobile_item_service_1.moneyText)(pdc.docAmount),
        })),
        onAccount: (0, mobile_item_service_1.moneyText)(onAccount),
        figures: {
            bills: new Map([...bills.entries()].map(([key, entry]) => [
                key,
                { amount: entry.amount, discount: entry.discount, roundoff: entry.roundoff },
            ])),
            credits: new Map([...credits.entries()].map(([key, entry]) => [key, entry.amount])),
        },
    };
}
function creditKindOf(billType) {
    switch (billType) {
        case receipt_enum_1.BillType.ADVANCE:
            return 'ADVANCE';
        case receipt_enum_1.BillType.SALES_RETURN:
            return 'SALES_RETURN';
        case receipt_enum_1.BillType.OPENING:
            return 'OPENING_CR';
        default:
            return 'JOURNAL_CR';
    }
}
function mergeByParty(bills, credits) {
    const out = [];
    let b = 0;
    let c = 0;
    while (b < bills.length || c < credits.length) {
        if (c >= credits.length ||
            (b < bills.length && bills[b].ablPartyId.localeCompare(credits[c].ablPartyId) <= 0)) {
            out.push({ kind: 'BILL', row: bills[b], ablPartyId: bills[b].ablPartyId });
            b += 1;
        }
        else {
            out.push({ kind: 'CREDIT', row: credits[c], ablPartyId: credits[c].ablPartyId });
            c += 1;
        }
    }
    return out;
}
function isDocRefnoClash(error) {
    const violated = (0, module_shared_utils_1.violatedConstraintOf)(error);
    return violated !== null && (violated.includes('doc_refno') || violated.includes('avh_party_id'));
}
let MobileReceiptService = class MobileReceiptService {
    prisma;
    requestContextService;
    receipts;
    posting;
    openItems;
    constructor(prisma, requestContextService, receipts, posting, openItems) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.receipts = receipts;
        this.posting = posting;
        this.openItems = openItems;
    }
    async options(query) {
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const device = await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, query.deviceUid);
        const branchId = query.branchId
            ? await (0, mobile_scope_1.requireMobileBranchOfCompany)(this.prisma, query.companyId, query.branchId, 'branchId')
            : await (0, mobile_scope_1.requireMobileBranch)(this.prisma, query.companyId, device.devBranchId);
        const today = await (0, mobile_scope_1.databaseToday)(this.prisma);
        const [tenders, companyWide, atBranch] = await Promise.all([
            this.tendersOf(query.companyId, branchId, today),
            this.openItems.loadSettings(query.companyId),
            this.openItems.loadSettings(query.companyId, branchId),
        ]);
        return {
            companyId: query.companyId,
            branchId,
            tenders,
            settings: {
                receiptBillSort: companyWide.billSort,
                salesmanMandatory: atBranch.salesmanMandatory,
                pdcPostingMode: atBranch.pdcPostingMode,
                ppdEnabled: companyWide.ppdSlabs.length > 0,
            },
        };
    }
    async openBills(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? mobile_receipt_dto_1.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE;
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const [bills, credits, settings] = await Promise.all([
            this.openItems.listCompanyOpenBills(query.companyId),
            query.withCredits === true
                ? this.openItems.listCompanyOpenCredits(query.companyId)
                : Promise.resolve([]),
            this.openItems.loadSettings(query.companyId),
        ]);
        const rows = await this.customersOnly(mergeByParty(bills, credits));
        const onDate = (0, receipt_utils_1.todayUtc)();
        const from = (page - 1) * pageSize;
        const slice = rows.slice(from, from + pageSize);
        const held = await this.openItems.loadPostDatedHeld(slice
            .filter((entry) => entry.kind === 'BILL')
            .map((entry) => ({ billId: entry.row.ablId, accYear: entry.row.ablAccYear })), onDate);
        return {
            items: slice.map((entry) => {
                const row = entry.row;
                const pending = new client_1.Prisma.Decimal(row.ablPendingAmount ?? 0);
                const isBill = entry.kind === 'BILL';
                return {
                    partyId: row.ablPartyId,
                    billId: row.ablId,
                    billAccYear: row.ablAccYear.trim(),
                    billType: row.ablBillType,
                    docRefno: row.ablDocRefno,
                    docDate: (0, receipt_utils_1.toDateString)(row.ablDocDate),
                    dueDate: (0, receipt_utils_1.toDateString)(row.ablDueDate),
                    billAmount: (0, mobile_item_service_1.moneyText)(row.ablBillAmount),
                    pendingAmount: (0, mobile_item_service_1.moneyText)(pending),
                    daysOverdue: isBill ? (0, receipt_utils_1.daysOverdue)(row.ablDueDate, onDate) : 0,
                    kind: isBill ? 'BILL' : creditKindOf(row.ablBillType),
                    paidAmount: (0, mobile_item_service_1.moneyText)(new client_1.Prisma.Decimal(row.ablBillAmount).minus(pending)),
                    pdcHeld: (0, mobile_item_service_1.moneyText)(isBill ? (held.get(`${row.ablId}|${row.ablAccYear}`) ?? ZERO) : ZERO),
                    ppdSchedule: isBill
                        ? (0, mobile_receipt_ppd_1.ppdScheduleOf)({
                            docDate: row.ablDocDate,
                            onDate,
                            pendingAmount: pending,
                            slabs: settings.ppdSlabs,
                        })
                        : [],
                };
            }),
            total: rows.length,
            page,
            pageSize,
            hasMore: from + pageSize < rows.length,
            companyId: query.companyId,
            onDate: (0, receipt_utils_1.toDateString)(onDate),
        };
    }
    async customersOnly(rows) {
        const partyIds = [...new Set(rows.map((row) => row.ablPartyId))];
        if (partyIds.length === 0) {
            return rows;
        }
        const found = await this.prisma.$queryRaw `
      SELECT c.cus_id::text AS "cusId"
        FROM sales.customers c
       WHERE c.cus_id = ANY(${partyIds}::uuid[])
         AND c.cus_is_deleted = false`;
        const customers = new Set(found.map((row) => row.cusId));
        return rows.filter((row) => customers.has(row.ablPartyId));
    }
    async create(dto) {
        const userId = (0, mobile_scope_1.requireMobileLogin)(this.requestContextService.getUserId());
        const plan = phonePlanOf(dto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'receipt', dto.avhCompanyId, dto.avhClientUuid);
                const stored = await this.findReceipt(tx, {
                    companyId: dto.avhCompanyId,
                    clientUuid: dto.avhClientUuid,
                });
                if (stored) {
                    return this.resendAnswer(tx, stored, dto, plan);
                }
                await (0, rights_1.assertMenuRight)(tx, {
                    userId,
                    menuId: receipt_enum_1.RECEIPT_MENU_ID,
                    right: 'post',
                    codePrefix: 'RCT',
                    action: 'post receipts',
                });
                await (0, mobile_scope_1.assertMobileCompany)(tx, dto.avhCompanyId, 'avhCompanyId');
                const device = await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
                const branchId = dto.avhBranchId
                    ? await (0, mobile_scope_1.requireMobileBranchOfCompany)(tx, dto.avhCompanyId, dto.avhBranchId, 'avhBranchId')
                    : await (0, mobile_scope_1.requireMobileBranch)(tx, dto.avhCompanyId, device.devBranchId);
                const receiptDay = receiptDayOf(dto.avhVoucherDate, await (0, mobile_scope_1.databaseToday)(tx));
                const accYear = await (0, mobile_scope_1.requireMobileAccYear)(tx, dto.avhCompanyId, receiptDay, 'avhVoucherDate');
                const collector = await this.collectorOf(tx, userId, dto.avhCompanyId, branchId);
                await this.assertDocRefnoFree(tx, dto, accYear);
                const draft = this.toDraftDto(dto, {
                    avhBranchId: branchId,
                    avhAccYear: accYear,
                    avhVoucherDate: receiptDay,
                    avhDeviceId: device.devId,
                    avhUserId: userId,
                    avhEmployeeId: collector ? [collector] : [],
                });
                const posted = await this.posting.saveAndPostInTransaction(tx, { ...draft, post: true }, (client, saved) => plan
                    ? this.settlePhonePlan(client, dto, plan, saved, receiptDay)
                    : this.fillOpenBills(client, dto, saved));
                const voucherId = posted.header.avhVoucherId;
                await tx.$executeRaw `
          UPDATE accounts.acc_voucher_header
             SET avh_client_uuid = ${dto.avhClientUuid}::uuid
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
                const saved = await this.findReceipt(tx, { voucherId, accYear });
                return this.answerFrom(tx, saved, settlementOf(posted), plan, false);
            }, receipt_posting_service_1.POST_TRANSACTION_OPTIONS);
        }
        catch (error) {
            if ((0, module_shared_utils_1.isUniqueConstraintError)(error) && isDocRefnoClash(error)) {
                this.refuseDocRefno(dto.avhDocRefno ?? '');
            }
            if ((0, mobile_scope_1.isClientUuidClash)(error)) {
                const stored = await this.findReceipt(this.prisma, {
                    companyId: dto.avhCompanyId,
                    clientUuid: dto.avhClientUuid,
                });
                if (stored) {
                    return this.resendAnswer(this.prisma, stored, dto, plan);
                }
            }
            throw (0, receipt_posting_service_1.rethrowAllocationError)(error);
        }
    }
    async collectorOf(tx, userId, companyId, branchId) {
        const login = await (0, mobile_login_1.findMobileLogin)(tx, userId);
        const employeeId = login?.employeeId ?? null;
        if (employeeId) {
            return employeeId;
        }
        const settings = await this.openItems.loadSettings(companyId, branchId);
        if (settings.salesmanMandatory) {
            (0, module_shared_utils_1.throwUnprocessable)('No collector', [
                {
                    field: 'avhEmployeeId',
                    code: mobile_error_codes_1.MobileErrorCode.RECEIPT_NO_EMPLOYEE,
                    message: `Login ${login?.loginName ?? userId} is not linked to an employee, and ` +
                        'accounts.receipt_salesman_mandatory needs a collector on every receipt. Link the ' +
                        'login to its employee on the User screen.',
                },
            ]);
        }
        return null;
    }
    async assertDocRefnoFree(tx, dto, accYear) {
        const refno = dto.avhDocRefno?.trim();
        if (!refno) {
            return;
        }
        const [taken] = await tx.$queryRaw `
      SELECT h.avh_voucher_refno AS refno
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE h.avh_company_id = ${dto.avhCompanyId}::uuid
         AND h.avh_party_id = ${dto.avhPartyId}::uuid
         AND h.avh_acc_year = ${accYear}::char(9)
         AND h.avh_doc_refno = ${refno}
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status <> ${receipt_enum_1.VoucherStatus.CANCELLED}
         AND t.vchr_type_code = ${receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE}
       LIMIT 1`;
        if (taken) {
            this.refuseDocRefno(refno, taken.refno);
        }
    }
    refuseDocRefno(refno, takenBy) {
        return (0, module_shared_utils_1.throwConflict)('Reference number already used', [
            {
                field: 'avhDocRefno',
                code: vouchers_errors_1.VCH.DUP_DOC_REFNO,
                message: `${refno} is already on a live receipt of this customer in this year` +
                    (takenBy ? ` (${takenBy}).` : '.'),
            },
        ]);
    }
    toDraftDto(dto, scope) {
        return {
            avhCompanyId: dto.avhCompanyId,
            avhPartyId: dto.avhPartyId,
            avhUsrRefno: dto.avhUsrRefno,
            avhRemarks: dto.avhRemarks,
            avhDocRefno: dto.avhDocRefno,
            avhDocDate: dto.avhDocDate,
            ...scope,
            avhDeviceType: receipt_enum_1.VoucherDeviceType.MOBILE,
            tenders: dto.tenders.map((tender, index) => ({ ...tender, tdRowNo: index + 1 })),
            replace: true,
        };
    }
    async fillOpenBills(tx, dto, saved) {
        const open = await this.openItems.listOpenItems({
            companyId: dto.avhCompanyId,
            partyId: dto.avhPartyId,
        });
        const locked = await (0, receipt_guards_1.lockBills)(tx, open.bills.map((bill) => ({ billId: bill.billId, billAccYear: bill.billAccYear })));
        const rooms = open.bills.flatMap((bill) => {
            const row = locked.get(`${bill.billId}|${bill.billAccYear}`);
            return row && !row.ablIsDeleted
                ? [{ billId: row.ablId, billAccYear: row.ablAccYear, pending: row.ablPendingAmount }]
                : [];
        });
        const filled = (0, mobile_receipt_settlement_1.fillOldestFirst)(rooms, (0, mobile_receipt_settlement_1.moneyForBills)(saved.tenders, saved.otherLines));
        return {
            allocations: filled.allocations.map((row) => ({
                billId: row.billId,
                billAccYear: row.billAccYear,
                amount: row.amount.toNumber(),
            })),
            onAccount: filled.onAccount.toNumber(),
        };
    }
    async settlePhonePlan(tx, dto, plan, saved, receiptDay) {
        const companyId = dto.avhCompanyId;
        const partyId = dto.avhPartyId;
        const [open, settings] = await Promise.all([
            this.openItems.listOpenItems({ companyId, partyId }),
            this.openItems.loadSettings(companyId),
        ]);
        const keys = new Map();
        for (const row of [...open.bills, ...plan.lines, ...plan.credits]) {
            keys.set((0, mobile_receipt_plan_1.billKeyOf)(row), { billId: row.billId, billAccYear: row.billAccYear.trim() });
        }
        const locked = await (0, receipt_guards_1.lockBills)(tx, [...keys.values()]);
        const nowOf = (key) => {
            const row = locked.get(key);
            if (!row) {
                return null;
            }
            const pending = new client_1.Prisma.Decimal(row.ablPendingAmount);
            return {
                billId: row.ablId,
                billAccYear: row.ablAccYear.trim(),
                docRefno: row.ablDocRefno,
                docDate: row.ablDocDate,
                pending,
                live: !row.ablIsDeleted && pending.greaterThan(0),
            };
        };
        const assertUsable = (row, kind, field) => {
            const found = locked.get((0, mobile_receipt_plan_1.billKeyOf)(row));
            if (!found || !found.ablIsDeleted) {
                (0, receipt_guards_1.assertBillUsable)(found, { billId: row.billId, partyId, companyId, kind, field });
            }
            return nowOf((0, mobile_receipt_plan_1.billKeyOf)(row));
        };
        const billsNow = new Map();
        plan.lines.forEach((line, index) => {
            billsNow.set((0, mobile_receipt_plan_1.billKeyOf)(line), assertUsable(line, 'RECEIVABLE', `allocations.${index}.billId`));
        });
        const creditsNow = new Map();
        plan.credits.forEach((credit, index) => {
            const now = assertUsable(credit, 'CREDIT', `creditsApplied.${index}.billId`);
            creditsNow.set((0, mobile_receipt_plan_1.billKeyOf)(credit), {
                billId: now.billId,
                billAccYear: now.billAccYear,
                docRefno: now.docRefno,
                held: now.pending,
                live: now.live,
            });
        });
        const openOrder = open.bills.flatMap((bill) => {
            const now = nowOf((0, mobile_receipt_plan_1.billKeyOf)(bill));
            return now && now.live ? [now] : [];
        });
        (0, mobile_receipt_plan_1.assertPhoneLimits)(plan.lines, billsNow, (0, receipt_utils_1.toDateOnly)(receiptDay), settings.ppdSlabs);
        const settled = (0, mobile_receipt_plan_1.reconcilePhonePlan)({
            lines: plan.lines,
            credits: plan.credits,
            billsNow,
            creditsNow,
            openOrder,
            money: (0, mobile_receipt_settlement_1.moneyForBills)(saved.tenders, saved.otherLines),
            fillAll: plan.fillAll,
        });
        return {
            allocations: settled.allocations.map((line) => ({
                billId: line.billId,
                billAccYear: line.billAccYear,
                amount: line.amount.toNumber(),
                discount: line.discount.toNumber(),
                roundoff: line.roundoff.toNumber(),
            })),
            creditsApplied: settled.creditsApplied.map((credit) => ({
                billId: credit.billId,
                billAccYear: credit.billAccYear,
                amount: credit.amount.toNumber(),
            })),
            onAccount: client_1.Prisma.Decimal.max(settled.onAccount, ZERO).toNumber(),
        };
    }
    async tendersOf(companyId, branchId, today) {
        const rows = await this.prisma.$queryRaw `
      SELECT t.tnd_id::text AS "tenderId", t.tnd_type_id AS "typeId",
             y.ttm_type_name AS "typeCode", t.tnd_name AS name,
             NULLIF(btrim(t.tnd_short_name), '') AS "shortName",
             (upper(y.ttm_type_name) = 'CHEQUE' OR COALESCE(t.tnd_needs_ref, y.ttm_needs_ref, false))
               AS "needsRef",
             NULLIF(btrim(y.ttm_ref_label), '') AS "refLabel",
             t.tnd_is_default AS "isDefault",
             t.tnd_surcharge_perc AS "surchargePerc", t.tnd_surcharge_amount AS "surchargeAmount",
             (upper(y.ttm_type_name) = 'CHEQUE') AS "requiresBank"
        FROM accounts.acc_tender_master t
        JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
       WHERE t.tnd_company_id = ${companyId}::uuid
         AND (t.tnd_branch_id IS NULL OR t.tnd_branch_id = ${branchId}::uuid)
         AND t.tnd_is_deleted = false
         AND t.tnd_is_active = true
         AND t.tnd_ledger_id IS NOT NULL
         AND (t.tnd_effective_from IS NULL OR t.tnd_effective_from <= ${today}::date)
         AND (t.tnd_effective_to IS NULL OR t.tnd_effective_to >= ${today}::date)
         AND y.ttm_is_deleted = false
         AND y.ttm_is_active = true
         AND upper(y.ttm_type_name) <> ALL(${exports.MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES}::text[])
       ORDER BY t.tnd_display_position, lower(t.tnd_name), t.tnd_id`;
        return rows.map((row) => ({
            ...row,
            surchargePerc: new client_1.Prisma.Decimal(row.surchargePerc).toFixed(3),
            surchargeAmount: (0, mobile_item_service_1.moneyText)(row.surchargeAmount),
        }));
    }
    async findReceipt(client, key) {
        const where = 'clientUuid' in key
            ? client_1.Prisma.sql `h.avh_company_id = ${key.companyId}::uuid
                 AND h.avh_client_uuid = ${key.clientUuid}::uuid`
            : client_1.Prisma.sql `h.avh_voucher_id = ${key.voucherId}::uuid
                 AND h.avh_acc_year = ${key.accYear}::char(9)`;
        const [row] = await client.$queryRaw `
      SELECT h.avh_voucher_id::text AS "avhVoucherId", h.avh_company_id::text AS "avhCompanyId",
             h.avh_branch_id::text AS "avhBranchId", btrim(h.avh_acc_year::text) AS "avhAccYear",
             h.avh_voucher_refno AS "avhVoucherRefno", h.avh_usr_refno AS "avhUsrRefno",
             h.avh_voucher_date::text AS "avhVoucherDate",
             h.avh_doc_amount AS "avhDocAmount", h.avh_voucher_status AS "avhVoucherStatus",
             h.avh_is_deleted AS "avhIsDeleted", h.avh_party_id::text AS "avhPartyId",
             h.avh_employee_id[1]::text AS "employeeId"
        FROM accounts.acc_voucher_header h
       WHERE ${where}
       ORDER BY h.avh_created_on
       LIMIT 1`;
        return row ?? null;
    }
    async resendAnswer(client, stored, dto, plan) {
        if (stored.avhPartyId !== dto.avhPartyId) {
            (0, module_shared_utils_1.throwConflict)('Receipt id already used', [
                {
                    field: 'avhClientUuid',
                    message: `avhClientUuid ${dto.avhClientUuid} already names receipt ${stored.avhVoucherRefno ?? stored.avhVoucherId} of another customer.`,
                    code: mobile_error_codes_1.MobileErrorCode.CLIENT_UUID_REUSED,
                },
            ]);
        }
        if (stored.avhIsDeleted) {
            return this.answerFrom(client, stored, NOTHING_SETTLED, plan, true);
        }
        const header = await this.receipts.loadHeaderOrThrow(client, stored.avhVoucherId, stored.avhAccYear);
        const full = await this.receipts.loadFullReceipt(client, header);
        return this.answerFrom(client, stored, settlementOf(full), plan, true);
    }
    async answerFrom(client, stored, settled, plan, duplicate) {
        const adjusted = plan &&
            !stored.avhIsDeleted &&
            stored.avhVoucherStatus !== receipt_enum_1.VoucherStatus.CANCELLED
            ? await this.adjustedOf(client, plan, settled)
            : [];
        return {
            avhVoucherId: stored.avhVoucherId,
            avhCompanyId: stored.avhCompanyId,
            avhBranchId: stored.avhBranchId,
            avhAccYear: stored.avhAccYear,
            avhVoucherRefno: stored.avhVoucherRefno,
            avhUsrRefno: stored.avhUsrRefno,
            avhVoucherDate: stored.avhVoucherDate,
            avhDocAmount: (0, mobile_item_service_1.moneyText)(stored.avhDocAmount ?? 0),
            avhVoucherStatus: stored.avhVoucherStatus,
            allocations: settled.allocations,
            onAccount: settled.onAccount,
            duplicate,
            avhIsDeleted: stored.avhIsDeleted,
            creditsApplied: settled.creditsApplied,
            pdcVouchers: settled.pdcVouchers,
            adjusted,
            employeeId: stored.employeeId,
        };
    }
    async adjustedOf(client, plan, settled) {
        const named = [...plan.lines, ...plan.credits];
        if (named.length === 0) {
            return [];
        }
        const rows = await client.$queryRaw `
      SELECT b.abl_id::text AS id, btrim(b.abl_acc_year::text) AS year, b.abl_doc_refno AS refno
        FROM accounts.acc_bill_balance b
       WHERE b.abl_id = ANY(${named.map((row) => row.billId)}::uuid[])`;
        const refnos = new Map(rows.map((row) => [`${row.id}|${row.year}`, row.refno]));
        return (0, mobile_receipt_plan_1.adjustedAgainstPlan)(plan, settled.figures, (key) => refnos.get(key) ?? '');
    }
};
exports.MobileReceiptService = MobileReceiptService;
exports.MobileReceiptService = MobileReceiptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        receipt_service_1.ReceiptService,
        receipt_posting_service_1.ReceiptPostingService,
        open_items_service_1.OpenItemsService])
], MobileReceiptService);
//# sourceMappingURL=mobile-receipt.service.js.map