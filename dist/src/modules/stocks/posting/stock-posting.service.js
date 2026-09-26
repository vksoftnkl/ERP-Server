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
exports.StockPostingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
let StockPostingService = class StockPostingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async post(tx, source, opts) {
        await this.assertNotFrozen(tx, source);
        return (0, stock_voucher_posting_helper_1.postStockVoucher)(tx, {
            rules: source.rules,
            svhId: source.svhId,
            accYear: source.accYear,
            actor: opts.actor,
            postedOn: opts.postedOn,
            ledgerSource: opts.ledgerSource,
        });
    }
    async cancel(tx, source, opts) {
        await this.assertNotFrozen(tx, source);
        return (0, stock_voucher_posting_helper_1.cancelStockVoucher)(tx, {
            rules: source.rules,
            svhId: source.svhId,
            accYear: source.accYear,
            actor: opts.actor,
            reason: opts.reason,
            cancelledOn: opts.cancelledOn,
        });
    }
    async assertNotFrozen(tx, source) {
        const movedAt = await source.docDatetime(tx);
        if (!movedAt) {
            return;
        }
        const godowns = await source.godownIds(tx);
        if (godowns.length === 0) {
            return;
        }
        const blocking = await tx.$queryRaw `
      SELECT c.svh_id, c.svh_refno,
             COALESCE(c.svh_from_godown_id, c.svh_to_godown_id) AS godown_id,
             c.svh_freeze_from, c.svh_freeze_to
        FROM stock.stock_voucher c
       WHERE c.svh_company_id = ${source.companyId}::uuid
         AND c.svh_branch_id  = ${source.branchId}::uuid
         -- ix_svh_freeze_open covers exactly these four predicates.
         AND c.svh_voucher_type = 'PHYSICAL'
         AND c.svh_freeze_stock = true
         AND c.svh_status       = 'DRAFT'
         AND c.svh_is_deleted   = false
         -- The count's own posting must not be blocked by its own freeze.
         AND c.svh_id <> ${source.srcDocId}::uuid
         AND COALESCE(c.svh_from_godown_id, c.svh_to_godown_id) = ANY(${godowns}::uuid[])
         -- sml_doc_datetime, NOT now(). See the class note.
         AND ${movedAt}::timestamptz BETWEEN c.svh_freeze_from AND c.svh_freeze_to
       LIMIT 1`;
        if (blocking.length > 0) {
            const b = blocking[0];
            throw new common_1.ConflictException(`Godown ${b.godown_id} is frozen for physical count ${b.svh_refno ?? b.svh_id} ` +
                `from ${b.svh_freeze_from.toISOString()} to ${b.svh_freeze_to.toISOString()}, ` +
                `and this movement is timed ${movedAt.toISOString()}, inside that window. ` +
                `Post or cancel the count first.`);
        }
    }
};
exports.StockPostingService = StockPostingService;
exports.StockPostingService = StockPostingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockPostingService);
//# sourceMappingURL=stock-posting.service.js.map