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
exports.MobileReceiptService = exports.MOBILE_RECEIPT_TENDER_TYPES = void 0;
exports.receiptDayOf = receiptDayOf;
exports.settlementOf = settlementOf;
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
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_scope_1 = require("../common/mobile-scope");
const mobile_item_service_1 = require("../item/mobile-item.service");
const mobile_receipt_dto_1 = require("./dto/mobile-receipt.dto");
const mobile_receipt_settlement_1 = require("./mobile-receipt-settlement");
exports.MOBILE_RECEIPT_TENDER_TYPES = ['CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK'];
function receiptDayOf(avhVoucherDate, today) {
    return avhVoucherDate ? avhVoucherDate.slice(0, 10) : today;
}
function settlementOf(payload) {
    const byBill = new Map();
    for (const row of payload.allocations) {
        if (row.againstBillId !== null || row.isReversed || row.reversalOfId !== null) {
            continue;
        }
        const key = `${row.billId}|${row.billAccYear}`;
        const entry = byBill.get(key) ?? {
            row: {
                billId: row.billId,
                billAccYear: row.billAccYear.trim(),
                docRefno: row.docRefno,
                amount: '0.00',
                pendingAmount: null,
            },
            amount: new client_1.Prisma.Decimal(0),
            pending: row.pendingAmount,
        };
        entry.amount = entry.amount.plus(row.amount);
        byBill.set(key, entry);
    }
    const allocations = [...byBill.values()].map((entry) => ({
        ...entry.row,
        amount: (0, mobile_item_service_1.moneyText)(entry.amount),
        pendingAmount: (0, mobile_item_service_1.moneyText)(entry.pending),
    }));
    const onAccount = payload.advanceBills.reduce((total, bill) => total.plus(bill.billAmount), new client_1.Prisma.Decimal(0));
    return { allocations, onAccount: (0, mobile_item_service_1.moneyText)(onAccount) };
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
        const branchId = await (0, mobile_scope_1.requireMobileBranch)(this.prisma, query.companyId, device.devBranchId);
        const today = await (0, mobile_scope_1.databaseToday)(this.prisma);
        return {
            companyId: query.companyId,
            branchId,
            tenders: await this.tendersOf(query.companyId, branchId, today),
        };
    }
    async openBills(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? mobile_receipt_dto_1.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE;
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const bills = await this.customersOnly(await this.openItems.listCompanyOpenBills(query.companyId));
        const onDate = (0, receipt_utils_1.todayUtc)();
        const from = (page - 1) * pageSize;
        return {
            items: bills.slice(from, from + pageSize).map((bill) => ({
                partyId: bill.ablPartyId,
                billId: bill.ablId,
                billAccYear: bill.ablAccYear.trim(),
                billType: bill.ablBillType,
                docRefno: bill.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(bill.ablDocDate),
                dueDate: (0, receipt_utils_1.toDateString)(bill.ablDueDate),
                billAmount: (0, mobile_item_service_1.moneyText)(bill.ablBillAmount),
                pendingAmount: (0, mobile_item_service_1.moneyText)(bill.ablPendingAmount ?? 0),
                daysOverdue: (0, receipt_utils_1.daysOverdue)(bill.ablDueDate, onDate),
            })),
            total: bills.length,
            page,
            pageSize,
            hasMore: from + pageSize < bills.length,
            companyId: query.companyId,
            onDate: (0, receipt_utils_1.toDateString)(onDate),
        };
    }
    async customersOnly(bills) {
        const partyIds = [...new Set(bills.map((bill) => bill.ablPartyId))];
        if (partyIds.length === 0) {
            return bills;
        }
        const rows = await this.prisma.$queryRaw `
      SELECT c.cus_id::text AS "cusId"
        FROM sales.customers c
       WHERE c.cus_id = ANY(${partyIds}::uuid[])
         AND c.cus_is_deleted = false`;
        const customers = new Set(rows.map((row) => row.cusId));
        return bills.filter((bill) => customers.has(bill.ablPartyId));
    }
    async create(dto) {
        const userId = (0, mobile_scope_1.requireMobileLogin)(this.requestContextService.getUserId());
        try {
            return await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'receipt', dto.avhCompanyId, dto.avhClientUuid);
                const stored = await this.findReceipt(tx, {
                    companyId: dto.avhCompanyId,
                    clientUuid: dto.avhClientUuid,
                });
                if (stored) {
                    return this.resendAnswer(tx, stored, dto);
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
                const branchId = await (0, mobile_scope_1.requireMobileBranch)(tx, dto.avhCompanyId, device.devBranchId);
                const receiptDay = receiptDayOf(dto.avhVoucherDate, await (0, mobile_scope_1.databaseToday)(tx));
                const accYear = await (0, mobile_scope_1.requireMobileAccYear)(tx, dto.avhCompanyId, receiptDay, 'avhVoucherDate');
                const draft = this.toDraftDto(dto, {
                    avhBranchId: branchId,
                    avhAccYear: accYear,
                    avhVoucherDate: receiptDay,
                    avhDeviceId: device.devId,
                    avhUserId: userId,
                });
                const posted = await this.posting.saveAndPostInTransaction(tx, { ...draft, post: true }, (client, saved) => this.fillOpenBills(client, dto, saved));
                const voucherId = posted.header.avhVoucherId;
                await tx.$executeRaw `
          UPDATE accounts.acc_voucher_header
             SET avh_client_uuid = ${dto.avhClientUuid}::uuid
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
                const saved = await this.findReceipt(tx, { voucherId, accYear });
                return this.toAnswer(saved, settlementOf(posted), false);
            }, receipt_posting_service_1.POST_TRANSACTION_OPTIONS);
        }
        catch (error) {
            if ((0, mobile_scope_1.isClientUuidClash)(error)) {
                const stored = await this.findReceipt(this.prisma, {
                    companyId: dto.avhCompanyId,
                    clientUuid: dto.avhClientUuid,
                });
                if (stored) {
                    return this.resendAnswer(this.prisma, stored, dto);
                }
            }
            throw (0, receipt_posting_service_1.rethrowAllocationError)(error);
        }
    }
    toDraftDto(dto, scope) {
        return {
            avhCompanyId: dto.avhCompanyId,
            avhPartyId: dto.avhPartyId,
            avhUsrRefno: dto.avhUsrRefno,
            avhRemarks: dto.avhRemarks,
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
    async tendersOf(companyId, branchId, today) {
        const rows = await this.prisma.$queryRaw `
      SELECT t.tnd_id::text AS "tenderId", t.tnd_type_id AS "typeId",
             y.ttm_type_name AS "typeCode", t.tnd_name AS name,
             NULLIF(btrim(t.tnd_short_name), '') AS "shortName",
             (y.ttm_type_name = 'CHEQUE' OR COALESCE(t.tnd_needs_ref, y.ttm_needs_ref, false))
               AS "needsRef",
             NULLIF(btrim(y.ttm_ref_label), '') AS "refLabel",
             t.tnd_is_default AS "isDefault",
             t.tnd_surcharge_perc AS "surchargePerc", t.tnd_surcharge_amount AS "surchargeAmount"
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
         AND y.ttm_type_name = ANY(${exports.MOBILE_RECEIPT_TENDER_TYPES}::text[])
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
             h.avh_is_deleted AS "avhIsDeleted", h.avh_party_id::text AS "avhPartyId"
        FROM accounts.acc_voucher_header h
       WHERE ${where}
       ORDER BY h.avh_created_on
       LIMIT 1`;
        return row ?? null;
    }
    async resendAnswer(client, stored, dto) {
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
            return this.toAnswer(stored, { allocations: [], onAccount: '0.00' }, true);
        }
        const header = await this.receipts.loadHeaderOrThrow(client, stored.avhVoucherId, stored.avhAccYear);
        const full = await this.receipts.loadFullReceipt(client, header);
        return this.toAnswer(stored, settlementOf(full), true);
    }
    toAnswer(stored, settled, duplicate) {
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
        };
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