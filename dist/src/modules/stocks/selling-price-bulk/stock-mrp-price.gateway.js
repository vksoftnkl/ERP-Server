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
exports.StockMrpPriceGateway = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const selling_price_bulk_types_1 = require("./types/selling-price-bulk.types");
let StockMrpPriceGateway = class StockMrpPriceGateway {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isDeployed = false;
    async findOpeningSeedBucket(args) {
        if (!this.isDeployed) {
            return this.notDeployed('19q Q6');
        }
        const [row] = await this.prisma.$queryRaw `
      SELECT smp.smp_mrp        AS "mrp",
             smp.smp_sale_price AS "salePrice"
        FROM stock.stock_mrp_price smp
       WHERE smp.smp_item_id = ${args.itemId}::uuid
         AND smp.smp_uom_id  = ${args.uomId}::uuid
         AND (smp.smp_company_id = ${args.companyId}::uuid OR smp.smp_company_id IS NULL)
         AND (smp.smp_branch_id  = ${args.branchId}::uuid  OR smp.smp_branch_id  IS NULL)
         AND ${args.onDate}::date BETWEEN smp.smp_effective_from AND smp.smp_effective_to
         AND smp.smp_is_active  = true
         AND smp.smp_is_deleted = false
       ORDER BY (smp.smp_branch_id  IS NULL),
                (smp.smp_company_id IS NULL),
                smp.smp_mrp DESC NULLS LAST
       LIMIT 1
    `;
        if (!row) {
            return null;
        }
        return {
            mrp: row.mrp === null ? 0 : (0, module_service_utils_1.toNumber)(row.mrp),
            salePrice: row.salePrice === null ? 0 : (0, module_service_utils_1.toNumber)(row.salePrice),
        };
    }
    async listPrices(_args) {
        return this.notDeployed('16q Q25');
    }
    async listBuckets(_itemId, _companyId, _branchId) {
        return this.notDeployed('16q Q24');
    }
    async validateRows(_tx, _candidates, _scope) {
        return this.notDeployed('16q Q26');
    }
    async findBucketRowForUpdate(_tx, _candidate, _scope) {
        return this.notDeployed('16q S1');
    }
    async updateBucketPrice(_tx, _smpId, _candidate) {
        return this.notDeployed('16q S2');
    }
    async insertBucketPrice(_tx, _candidate, _scope) {
        return this.notDeployed('16q S3');
    }
    async listNoStock(_tx, _smpIds, _branchId) {
        return this.notDeployed('16q Q27');
    }
    notDeployed(statement) {
        throw new common_1.ServiceUnavailableException((0, module_service_utils_1.buildStockErrorResponse)(selling_price_bulk_types_1.STOCK_MRP_PRICE_NOT_DEPLOYED, [
            {
                field: 'stock.stock_mrp_price',
                message: `${selling_price_bulk_types_1.STOCK_MRP_PRICE_NOT_DEPLOYED} Waiting on ${statement}.`,
            },
        ]));
    }
};
exports.StockMrpPriceGateway = StockMrpPriceGateway;
exports.StockMrpPriceGateway = StockMrpPriceGateway = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockMrpPriceGateway);
//# sourceMappingURL=stock-mrp-price.gateway.js.map