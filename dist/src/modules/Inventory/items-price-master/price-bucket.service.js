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
exports.PriceBucketService = exports.DEFAULT_PRICE_LEVEL_SETTING_KEY = void 0;
exports.todayIso = todayIso;
exports.toBucketSource = toBucketSource;
const common_1 = require("@nestjs/common");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_posting_helper_1 = require("../../stocks/stock-voucher/stock-voucher-posting.helper");
const price_resolver_1 = require("./price-resolver");
exports.DEFAULT_PRICE_LEVEL_SETTING_KEY = 'sales.default_price_level';
function todayIso(now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}
let PriceBucketService = class PriceBucketService {
    appSettingValueService;
    constructor(appSettingValueService) {
        this.appSettingValueService = appSettingValueService;
    }
    async deriveBuckets(client, itemId, rows, onDate = todayIso()) {
        if (!rows.length) {
            return [];
        }
        const item = await client.itemMaster.findUnique({
            where: { itemId },
            select: { itemCompanyId: true, itemBranchId: true },
        });
        const scopes = rows.map((row) => ({
            itemId,
            companyId: row.companyId ?? item?.itemCompanyId ?? null,
            branchId: row.branchId ?? item?.itemBranchId ?? null,
        }));
        const flags = await (0, stock_voucher_posting_helper_1.readBucketTrackFlags)(client, scopes, onDate);
        const levels = new Map();
        const keys = [];
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            const policy = flags[index];
            let salePrice = null;
            if (policy.trackSalePrice) {
                const level = await this.defaultPriceLevel(scopes[index], levels);
                salePrice = row.prices[level - 1] ?? null;
            }
            keys.push((0, stock_voucher_posting_helper_1.bucketKeyFor)(policy, { mrp: row.maxPrice, salePrice }));
        }
        return keys;
    }
    async rekeyItem(tx, itemId) {
        const rows = await tx.itemPriceMaster.findMany({
            where: { ipmItemId: itemId, ipmIsDeleted: false },
            include: { itemUnitConversion: { include: { unit: true } } },
            orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
        });
        if (!rows.length) {
            return 0;
        }
        const derived = await this.deriveBuckets(tx, itemId, rows.map(toBucketSource));
        const describe = (index) => {
            const row = rows[index];
            const unit = row.itemUnitConversion.unit?.unit_name ?? row.ipmUcUnitId;
            const scope = row.ipmBranchId === null ? 'all branches' : 'one branch';
            return `the ${unit} price at MRP ${(0, module_service_utils_1.toNumber)(row.ipmMaxPrice)} (${scope}, ${row.ipmId})`;
        };
        for (let a = 0; a < rows.length; a += 1) {
            for (let b = a + 1; b < rows.length; b += 1) {
                if (collide(rows[a], derived[a], rows[b], derived[b])) {
                    (0, module_service_utils_1.throwInventoryConflict)("These prices would become one under the item's stock tracking", [
                        {
                            field: 'prices',
                            message: `${describe(a)} and ${describe(b)} are one price once the item no longer ` +
                                'tracks what tells them apart. Delete one of them, then save again.',
                        },
                    ]);
                }
            }
        }
        const changed = rows
            .map((row, index) => ({ row, key: derived[index], index }))
            .filter(({ row, key }) => !(0, price_resolver_1.sameBucket)((0, price_resolver_1.bucketKeyOfRow)(row), key));
        for (const { row, key, index } of changed) {
            const mrp = key.mrp;
            if (mrp !== null && toBucketSource(row).prices.some((price) => price > mrp)) {
                (0, module_service_utils_1.throwUnprocessable)('A price is above the MRP it would be bucketed under', [
                    {
                        field: 'prices',
                        message: `${describe(index)} sells above its MRP. A price per MRP cannot exceed that ` +
                            'MRP; correct the price, then change the tracking.',
                    },
                ]);
            }
        }
        if (!changed.length) {
            return 0;
        }
        await tx.$executeRaw `SET CONSTRAINTS inventory.ex_ipm_overlap DEFERRED`;
        const now = new Date();
        for (const { row, key } of changed) {
            await tx.itemPriceMaster.update({
                where: { ipmId: row.ipmId },
                data: { ipmBucketMrp: key.mrp, ipmBucketSp: key.salePrice, ipmUpdatedOn: now },
            });
        }
        await tx.$executeRaw `SET CONSTRAINTS inventory.ex_ipm_overlap IMMEDIATE`;
        return changed.length;
    }
    async defaultPriceLevel(scope, cache) {
        const cacheKey = `${scope.companyId ?? ''}|${scope.branchId ?? ''}`;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const effective = await this.appSettingValueService.resolveEffective({
            companyId: scope.companyId ?? undefined,
            branchId: scope.branchId ?? undefined,
        });
        const raw = effective.find((entry) => entry.asdKey === exports.DEFAULT_PRICE_LEVEL_SETTING_KEY)?.value;
        const parsed = Number.parseInt(raw ?? '', 10);
        const level = parsed >= 1 && parsed <= 4 ? parsed : 1;
        cache.set(cacheKey, level);
        return level;
    }
};
exports.PriceBucketService = PriceBucketService;
exports.PriceBucketService = PriceBucketService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_setting_value_service_1.AppSettingValueService])
], PriceBucketService);
function toBucketSource(row) {
    return {
        companyId: row.ipmCompanyId,
        branchId: row.ipmBranchId,
        maxPrice: (0, module_service_utils_1.toNumber)(row.ipmMaxPrice),
        prices: [
            (0, module_service_utils_1.toNumber)(row.ipmSalesPriceA),
            (0, module_service_utils_1.toNumber)(row.ipmSalesPriceB),
            (0, module_service_utils_1.toNumber)(row.ipmSalesPriceC),
            (0, module_service_utils_1.toNumber)(row.ipmSalesPriceD),
        ],
    };
}
function collide(a, keyA, b, keyB) {
    return (a.ipmCompanyId === b.ipmCompanyId &&
        a.ipmBranchId === b.ipmBranchId &&
        a.ipmUcUnitId === b.ipmUcUnitId &&
        (0, price_resolver_1.sameBucket)(keyA, keyB) &&
        (0, price_resolver_1.toDay)(a.ipmEffectiveFrom) <= (0, price_resolver_1.toDay)(b.ipmEffectiveTo) &&
        (0, price_resolver_1.toDay)(b.ipmEffectiveFrom) <= (0, price_resolver_1.toDay)(a.ipmEffectiveTo));
}
//# sourceMappingURL=price-bucket.service.js.map