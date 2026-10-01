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
var StockAdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockAdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_accounts_posting_service_1 = require("./stock-accounts-posting.service");
const stock_balance_assertion_1 = require("./stock-balance-assertion");
const DISPLAY_NAME = {
    OPENING: 'Opening stock',
    PHYSICAL: 'Physical stock count',
};
let StockAdminService = StockAdminService_1 = class StockAdminService {
    prisma;
    accounts;
    requestContext;
    logger = new common_1.Logger(StockAdminService_1.name);
    constructor(prisma, accounts, requestContext) {
        this.prisma = prisma;
        this.accounts = accounts;
        this.requestContext = requestContext;
    }
    async postMissingVouchers(companyId, accYear) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const missing = await this.prisma.$queryRaw `
      SELECT svh.svh_id, svh.svh_refno, svh.svh_branch_id, svh.svh_voucher_type
        FROM stock.stock_voucher svh
       WHERE svh.svh_company_id = ${companyId}::uuid
         AND svh.svh_acc_year   = ${accYear}::bpchar
         AND svh.svh_status     = 'POSTED'
         AND svh.svh_is_deleted = false
         AND svh.svh_voucher_type IN ('OPENING', 'PHYSICAL')
         AND NOT EXISTS (
               SELECT 1 FROM accounts.acc_voucher_header avh
                WHERE avh.avh_company_id   = svh.svh_company_id
                  AND avh.avh_src_module   = ${stock_accounts_posting_service_1.STOCK_ACCOUNTS_SRC_MODULE}
                  AND avh.avh_src_doc_type = svh.svh_voucher_type
                  AND avh.avh_src_doc_id   = svh.svh_id
                  AND avh.avh_acc_year     = svh.svh_acc_year
                  AND avh.avh_is_deleted   = false
                  AND avh.avh_voucher_status = 'POSTED')
       ORDER BY svh.svh_doc_date, svh.svh_slno
    `;
        let posted = 0;
        const skipped = [];
        for (const row of missing) {
            const voucherType = row.svh_voucher_type;
            try {
                const result = await this.prisma.$transaction((tx) => this.accounts.postForVoucher(tx, {
                    svhId: row.svh_id,
                    accYear,
                    companyId,
                    branchId: row.svh_branch_id,
                    voucherType,
                    displayName: DISPLAY_NAME[voucherType] ?? voucherType,
                    actor,
                    postedOn: new Date(),
                }));
                if (result) {
                    posted += 1;
                }
                else {
                    skipped.push({ svhId: row.svh_id, refno: row.svh_refno, reason: 'nothing to post (PERIODIC or zero value)' });
                }
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                this.logger.warn(`post-missing-vouchers: ${row.svh_refno} skipped — ${reason}`);
                skipped.push({ svhId: row.svh_id, refno: row.svh_refno, reason });
            }
        }
        return { walked: missing.length, posted, skipped };
    }
    assertBalances(scope) {
        return (0, stock_balance_assertion_1.assertStockBalances)(this.prisma, scope);
    }
};
exports.StockAdminService = StockAdminService;
exports.StockAdminService = StockAdminService = StockAdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_accounts_posting_service_1.StockAccountsPostingService,
        request_context_service_1.RequestContextService])
], StockAdminService);
//# sourceMappingURL=stock-admin.service.js.map