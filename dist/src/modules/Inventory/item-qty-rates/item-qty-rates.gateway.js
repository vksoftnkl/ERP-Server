"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemQtyRatesGateway = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let ItemQtyRatesGateway = class ItemQtyRatesGateway {
    async lockItem(tx, itemId) {
        await tx.$queryRaw `
      SELECT count(pg_advisory_xact_lock(hashtext('inventory.item_qty_price'), hashtext(${itemId}::uuid::text)))::int AS locked`;
    }
    async levels(client) {
        const rows = await client.$queryRaw `
      SELECT price_lvl_id::int AS id, price_lvl_name AS name, price_lvl_short AS short,
             (price_lvl_is_active IS TRUE AND "price_lvl_isDeleted" IS NOT TRUE) AS active
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4`;
        const byId = new Map(rows.map((row) => [Number(row.id), row]));
        return [1, 2, 3, 4].map((level) => ({
            level,
            name: byId.get(level)?.name?.trim() || `Price ${'ABCD'[level - 1]}`,
            short: byId.get(level)?.short?.trim() || null,
            active: byId.get(level)?.active === true,
        }));
    }
    async units(client, itemId) {
        const rows = await client.$queryRaw `
      SELECT iuc.iuc_id AS uom_id, u.unit_name, iuc.iuc_unit_slno AS unit_slno,
             iuc.iuc_to_base_factor AS to_base, iuc.iuc_unit_factor AS unit_factor,
             LAG(iuc.iuc_id)             OVER w AS parent_uom_id,
             LAG(u.unit_name)            OVER w AS parent_unit_name,
             LAG(iuc.iuc_to_base_factor) OVER w AS parent_to_base
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE iuc.iuc_item_id = ${itemId}::uuid
         AND iuc.iuc_is_active = true
         AND iuc.iuc_is_deleted = false
      WINDOW w AS (ORDER BY iuc.iuc_unit_slno, iuc.iuc_id)
       ORDER BY iuc.iuc_unit_slno, iuc.iuc_id`;
        const one = new client_1.Prisma.Decimal(1);
        return rows.map((row) => ({
            uomId: row.uom_id,
            unitName: row.unit_name,
            unitSlno: row.unit_slno ?? 0,
            toBase: row.to_base ?? one,
            unitFactor: row.unit_factor ?? one,
            parentUomId: row.parent_uom_id,
            parentUnitName: row.parent_unit_name,
            parentToBase: row.parent_uom_id ? (row.parent_to_base ?? one) : null,
        }));
    }
    async priceRows(client, itemId, companyId, branchId) {
        return client.itemPriceMaster.findMany({
            where: {
                ipmItemId: itemId,
                ipmIsDeleted: false,
                AND: [
                    { OR: [{ ipmCompanyId: companyId }, { ipmCompanyId: null }] },
                    { OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }] },
                ],
            },
            orderBy: [{ ipmId: 'asc' }],
        });
    }
    async liveSlabs(client, itemId) {
        return client.itemQtyPrice.findMany({
            where: { iqpItemId: itemId, iqpIsDeleted: false },
            orderBy: [{ iqpItemUnitId: 'asc' }, { iqpFromQty: 'asc' }, { iqpId: 'asc' }],
        });
    }
    async barcode(client, itemId) {
        const item = await client.itemMaster.findUnique({
            where: { itemId },
            select: { itemDefaultBarcode: true },
        });
        return item?.itemDefaultBarcode ?? null;
    }
    async today(client) {
        const [row] = await client.$queryRaw `SELECT CURRENT_DATE::text AS today`;
        return row.today;
    }
};
exports.ItemQtyRatesGateway = ItemQtyRatesGateway;
exports.ItemQtyRatesGateway = ItemQtyRatesGateway = __decorate([
    (0, common_1.Injectable)()
], ItemQtyRatesGateway);
//# sourceMappingURL=item-qty-rates.gateway.js.map