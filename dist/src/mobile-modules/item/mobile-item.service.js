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
exports.MobileItemService = exports.MOBILE_HIDDEN_PRICE_LEVEL = void 0;
exports.moneyText = moneyText;
exports.qty3 = qty3;
exports.unitPriceAnswer = unitPriceAnswer;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const price_resolver_1 = require("../../modules/Inventory/items-price-master/price-resolver");
const mobile_scope_1 = require("../common/mobile-scope");
const mobile_item_dto_1 = require("./dto/mobile-item.dto");
exports.MOBILE_HIDDEN_PRICE_LEVEL = 7;
function moneyText(value) {
    return value === null || value === undefined ? null : new client_1.Prisma.Decimal(value).toFixed(2);
}
function qty3(value) {
    return Number(value.toDecimalPlaces(3).toString());
}
function unitPriceAnswer(unitRows, onDate, caller) {
    const headline = (0, price_resolver_1.resolveEffectivePrice)(unitRows, price_resolver_1.HEADLINE_KEY, onDate, caller);
    if (headline) {
        return headline;
    }
    const keys = [];
    for (const row of unitRows) {
        const key = (0, price_resolver_1.bucketKeyOfRow)(row);
        if (!(0, price_resolver_1.isHeadlineKey)(key) && !keys.some((known) => (0, price_resolver_1.sameBucket)(known, key))) {
            keys.push(key);
        }
    }
    keys.sort((a, b) => (b.mrp ?? -1) - (a.mrp ?? -1) || (b.salePrice ?? -1) - (a.salePrice ?? -1));
    for (const key of keys) {
        const answer = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, onDate, caller);
        if (answer) {
            return answer;
        }
    }
    return null;
}
let MobileItemService = class MobileItemService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async options() {
        const [companies, groups, brands, levels] = await Promise.all([
            this.prisma.company.findMany({
                where: { compIsDeleted: false, compIsActive: true },
                select: { compId: true, compName: true, compCity: true },
                orderBy: [{ compName: 'asc' }, { compId: 'asc' }],
            }),
            this.prisma.itemGroupMaster.findMany({
                where: { itgIsDeleted: false, itgIsActive: true },
                select: { itgId: true, itgName: true, itgSort: true },
                orderBy: [{ itgSort: { sort: 'asc', nulls: 'last' } }, { itgName: 'asc' }],
            }),
            this.prisma.itemBrandMaster.findMany({
                where: { brand_is_deleted: false, brand_is_active: true },
                select: { brand_id: true, brand_name: true, brand_sort: true },
                orderBy: [{ brand_sort: { sort: 'asc', nulls: 'last' } }, { brand_name: 'asc' }],
            }),
            this.prisma.itemPriceLevel.findMany({
                where: { iplIsDeleted: false, iplStatus: true, iplId: { not: exports.MOBILE_HIDDEN_PRICE_LEVEL } },
                select: { iplId: true, iplName: true },
                orderBy: { iplId: 'asc' },
            }),
        ]);
        return {
            companies: companies.map((c) => ({ id: c.compId, name: c.compName, place: c.compCity })),
            itemGroups: groups.map((g) => ({ id: g.itgId, name: g.itgName, position: g.itgSort })),
            brands: brands.map((b) => ({ id: b.brand_id, name: b.brand_name, position: b.brand_sort })),
            priceLevels: levels.map((l) => ({ id: l.iplId, name: l.iplName })),
        };
    }
    async list(q) {
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? mobile_item_dto_1.MOBILE_ITEM_DEFAULT_PAGE_SIZE;
        const company = await (0, mobile_scope_1.assertMobileCompany)(this.prisma, q.companyId);
        const device = q.deviceUid ? await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, q.deviceUid) : null;
        const [branchId, today] = await Promise.all([
            (0, mobile_scope_1.findMobileBranch)(this.prisma, q.companyId, device?.devBranchId ?? null),
            (0, mobile_scope_1.databaseToday)(this.prisma),
        ]);
        const where = client_1.Prisma.sql `
       WHERE i.item_is_deleted = false
         AND i.item_is_active = true
         AND i.item_allow_so = true
         AND (i.item_company_id IS NULL OR i.item_company_id = ${q.companyId}::uuid)
         AND (${branchId}::uuid IS NULL OR i.item_branch_id IS NULL OR i.item_branch_id = ${branchId}::uuid)`;
        const [countRows, rows] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT count(*)::int AS n FROM inventory.item_master i ${where}`,
            this.prisma.$queryRaw `
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_name_ta,
               i.item_group_id, g.itg_name, i.item_brand_id, b.brand_name,
               i.item_allow_loading, i.item_allow_freight, i.item_allow_promo,
               i.item_incl_tax, i.item_hsn_code, i.item_default_tax_id,
               t.tax_rate_perc
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN inventory.item_brand_master b ON b.brand_id = i.item_brand_id
          LEFT JOIN inventory.tax_rate_master t
                 ON t.tax_id = i.item_default_tax_id AND t.tax_is_deleted = false
          ${where}
         ORDER BY lower(i.item_name_en), i.item_id
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        ]);
        const total = countRows[0]?.n ?? 0;
        const itemIds = rows.map((r) => r.item_id);
        const caller = { companyId: q.companyId, branchId };
        const [units, priceRows, stock] = itemIds.length
            ? await Promise.all([
                this.prisma.itemUnitConversion.findMany({
                    where: { iucItemId: { in: itemIds }, iucIsDeleted: false, iucIsActive: true },
                    select: {
                        iucId: true,
                        iucItemId: true,
                        iucUnitId: true,
                        iucToBaseFactor: true,
                        iucIsDefaultUnit: true,
                        iucIsBaseUnit: true,
                        iucUomWeight: true,
                        unit: { select: { unit_name: true } },
                    },
                    orderBy: [{ iucItemId: 'asc' }, { iucUnitSlno: 'asc' }, { iucId: 'asc' }],
                }),
                this.prisma.itemPriceMaster.findMany({
                    where: {
                        ipmItemId: { in: itemIds },
                        ipmIsDeleted: false,
                        AND: [
                            { OR: [{ ipmCompanyId: q.companyId }, { ipmCompanyId: null }] },
                            ...(branchId ? [{ OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }] }] : []),
                        ],
                    },
                    orderBy: [{ ipmId: 'asc' }],
                }),
                this.prisma.$queryRaw `
            SELECT b.sbl_item_id AS item_id, SUM(b.sbl_available_qty) AS qty
              FROM stock.stock_balance b
             WHERE b.sbl_item_id = ANY(${itemIds}::uuid[])
               AND b.sbl_company_id = ${q.companyId}::uuid
               AND b.sbl_is_deleted = false
               AND b.sbl_bucket = 'SALEABLE'
             GROUP BY b.sbl_item_id`,
            ])
            : [[], [], []];
        const unitsByItem = groupBy(units, (u) => u.iucItemId);
        const pricesByItem = groupBy(priceRows, (p) => p.ipmItemId);
        const stockByItem = new Map(stock.map((s) => [s.item_id, new client_1.Prisma.Decimal(s.qty ?? 0)]));
        const items = rows.map((row) => this.toItem(row, unitsByItem.get(row.item_id) ?? [], (0, price_resolver_1.livePriceRows)(pricesByItem.get(row.item_id) ?? [], today, caller), stockByItem.get(row.item_id) ?? new client_1.Prisma.Decimal(0), company.compGstApplicable, today, caller));
        return {
            items,
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
            companyId: q.companyId,
            branchId,
            priceDate: today,
        };
    }
    toItem(row, units, liveRows, baseQty, gstApplicable, today, caller) {
        return {
            itemId: row.item_id,
            itemCode: row.item_code,
            itemNameEn: row.item_name_en,
            itemNameTa: row.item_name_ta,
            itemGroupId: row.item_group_id,
            itemGroupName: row.itg_name,
            itemBrandId: row.item_brand_id,
            itemBrandName: row.brand_name,
            allowLoading: row.item_allow_loading,
            allowFreight: row.item_allow_freight,
            allowPromo: row.item_allow_promo,
            inclTax: row.item_incl_tax,
            hsnCode: row.item_hsn_code,
            taxId: row.item_default_tax_id,
            taxPerc: new client_1.Prisma.Decimal(gstApplicable && row.tax_rate_perc !== null ? row.tax_rate_perc : 0).toFixed(3),
            availableBaseQty: qty3(baseQty),
            units: units.map((unit) => this.toUnit(unit, liveRows.filter((p) => p.ipmUcUnitId === unit.iucId), baseQty, today, caller)),
        };
    }
    toUnit(unit, unitRows, baseQty, today, caller) {
        const answer = unitPriceAnswer(unitRows, today, caller);
        const rate = answer?.row ?? null;
        const factor = unit.iucToBaseFactor;
        return {
            iucId: unit.iucId,
            unitId: unit.iucUnitId,
            unitName: unit.unit?.unit_name ?? null,
            factor: Number(factor.toString()),
            isDefaultUnit: unit.iucIsDefaultUnit,
            isBaseUnit: unit.iucIsBaseUnit,
            weight: Number(unit.iucUomWeight.toString()),
            priced: rate !== null,
            priceA: moneyText(rate?.ipmSalesPriceA),
            priceB: moneyText(rate?.ipmSalesPriceB),
            priceC: moneyText(rate?.ipmSalesPriceC),
            priceD: moneyText(rate?.ipmSalesPriceD),
            mrp: moneyText(rate?.ipmMaxPrice),
            minPrice: moneyText(rate?.ipmMinPrice),
            loadingCharge: moneyText(rate?.ipmLoadingCharge),
            freightCharge: moneyText(rate?.ipmFreightCharge),
            priceSource: answer?.source ?? null,
            priceScope: answer?.scope ?? null,
            availableQty: factor.gt(0) ? qty3(baseQty.div(factor)) : 0,
        };
    }
};
exports.MobileItemService = MobileItemService;
exports.MobileItemService = MobileItemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MobileItemService);
function groupBy(rows, keyOf) {
    const map = new Map();
    for (const row of rows) {
        const key = keyOf(row);
        const list = map.get(key);
        if (list) {
            list.push(row);
        }
        else {
            map.set(key, [row]);
        }
    }
    return map;
}
//# sourceMappingURL=mobile-item.service.js.map