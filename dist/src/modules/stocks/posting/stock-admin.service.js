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
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
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
                    skipped.push({
                        svhId: row.svh_id,
                        refno: row.svh_refno,
                        reason: 'nothing to post (PERIODIC or zero value)',
                    });
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
    async rebuildCosts(scope, dryRun) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const now = new Date();
        let report = null;
        try {
            await this.prisma.$transaction(async (tx) => {
                const before = await this.itemTotals(tx, scope);
                const written = await (0, stock_voucher_posting_helper_1.rebuildStockDerivedFigures)(tx, scope, actor, now);
                const after = await this.itemTotals(tx, scope);
                const lotsMoved = await this.lotRatesMoved(tx, scope);
                const moved = [];
                for (const [key, next] of after) {
                    const prev = before.get(key);
                    if (!prev ||
                        prev.totalQty !== next.totalQty ||
                        prev.totalValue !== next.totalValue ||
                        prev.avgCostRate !== next.avgCostRate) {
                        moved.push({
                            ...next,
                            oldTotalQty: prev?.totalQty ?? null,
                            oldTotalValue: prev?.totalValue ?? null,
                            oldAvgCostRate: prev?.avgCostRate ?? null,
                            valueDifference: prev === undefined
                                ? next.totalValue
                                : Number((Number(next.totalValue) - Number(prev.totalValue)).toFixed(2)),
                        });
                    }
                }
                const assertion = await (0, stock_balance_assertion_1.assertStockBalances)(tx, scope);
                report = { dryRun, written, itemsMoved: moved, lotRatesWritten: lotsMoved, assertion };
                if (dryRun) {
                    throw new DryRunRollback();
                }
            }, { maxWait: 30_000, timeout: 10 * 60_000 });
        }
        catch (error) {
            if (!(error instanceof DryRunRollback)) {
                throw error;
            }
        }
        if (!report) {
            throw new Error('rebuild-costs produced no report');
        }
        return report;
    }
    async itemTotals(tx, scope) {
        const rows = await tx.$queryRaw `
      SELECT c.sic_company_id AS company_id, c.sic_branch_id AS branch_id, c.sic_item_id AS item_id,
             itm.item_code, itm.item_name_en AS item_name,
             c.sic_total_qty::text AS total_qty, c.sic_total_value::text AS total_value,
             c.sic_avg_cost_rate::text AS avg_cost_rate
        FROM stock.stock_item_cost c
        JOIN inventory.item_master itm ON itm.item_id = c.sic_item_id
       WHERE c.sic_is_deleted = false
         AND (${scope.companyId ?? null}::uuid IS NULL OR c.sic_company_id = ${scope.companyId ?? null}::uuid)
         AND (${scope.branchId ?? null}::uuid  IS NULL OR c.sic_branch_id  = ${scope.branchId ?? null}::uuid)
         AND (${scope.itemId ?? null}::uuid    IS NULL OR c.sic_item_id    = ${scope.itemId ?? null}::uuid)
    `;
        return new Map(rows.map((r) => [
            `${r.company_id}|${r.branch_id}|${r.item_id}`,
            {
                companyId: r.company_id,
                branchId: r.branch_id,
                itemId: r.item_id,
                itemCode: r.item_code,
                itemName: r.item_name,
                totalQty: r.total_qty,
                totalValue: r.total_value,
                avgCostRate: r.avg_cost_rate,
            },
        ]));
    }
    async lotRatesMoved(tx, scope) {
        const rows = await tx.$queryRaw `
      SELECT b.sbl_branch_id AS branch_id, itm.item_code, itm.item_name_en AS item_name,
             b.sbl_lot_id AS lot_id, slt.slt_batch_no AS batch_no, slt.slt_mrp::text AS mrp,
             SUM(b.sbl_on_hand_qty)::text AS on_hand, MAX(b.sbl_avg_cost_rate)::text AS rate,
             SUM(b.sbl_stock_value)::text AS value
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        JOIN inventory.item_master itm ON itm.item_id = b.sbl_item_id
       WHERE b.sbl_is_deleted = false
         AND slt.slt_track_signature <> 'N'
         AND (${scope.companyId ?? null}::uuid IS NULL OR b.sbl_company_id = ${scope.companyId ?? null}::uuid)
         AND (${scope.branchId ?? null}::uuid  IS NULL OR b.sbl_branch_id  = ${scope.branchId ?? null}::uuid)
         AND (${scope.itemId ?? null}::uuid    IS NULL OR b.sbl_item_id    = ${scope.itemId ?? null}::uuid)
       GROUP BY 1, 2, 3, 4, 5, 6
       ORDER BY itm.item_name_en, slt.slt_batch_no
    `;
        return rows.map((r) => ({
            branchId: r.branch_id,
            itemCode: r.item_code,
            itemName: r.item_name,
            lotId: r.lot_id,
            batchNo: r.batch_no,
            mrp: r.mrp,
            onHand: r.on_hand,
            rate: r.rate,
            value: r.value,
        }));
    }
};
exports.StockAdminService = StockAdminService;
exports.StockAdminService = StockAdminService = StockAdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_accounts_posting_service_1.StockAccountsPostingService,
        request_context_service_1.RequestContextService])
], StockAdminService);
class DryRunRollback extends Error {
}
//# sourceMappingURL=stock-admin.service.js.map