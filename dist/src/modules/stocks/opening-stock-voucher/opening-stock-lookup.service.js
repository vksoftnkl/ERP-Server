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
exports.OpeningStockLookupService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_mrp_price_gateway_1 = require("../selling-price-bulk/stock-mrp-price.gateway");
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
let OpeningStockLookupService = class OpeningStockLookupService {
    prisma;
    mrpPrices;
    constructor(prisma, mrpPrices) {
        this.prisma = prisma;
        this.mrpPrices = mrpPrices;
    }
    async lookupItem(args) {
        const uomId = args.uomId ?? null;
        const companyId = args.companyId ?? null;
        const branchId = args.branchId ?? null;
        const [row] = await this.prisma.$queryRaw `
      SELECT i.item_id                                         AS "itemId",
             i.item_code                                       AS "itemCode",
             i.item_name_en                                    AS "itemName",
             i.item_default_barcode                            AS "barcode",

             -- The unit the line is keyed in, and the unit it is STORED in.
             -- Both are iuc_ids, never unit_ids — svi_uom_id and
             -- svi_base_uom_id both point at the conversion row.
             u.iuc_id                                          AS "uomId",
             um.unit_name                                      AS "unitName",
             u.iuc_to_base_factor                              AS "toBaseFactor",
             b.iuc_id                                          AS "baseUomId",

             COALESCE(t.tax_gst_rate_total, 0)                 AS "taxPerc",
             COALESCE(t.tax_cess_perc, 0)                      AS "cessPerc",
             COALESCE(t.tax_cess_unit, 0)                      AS "cessUnit",

             -- Which identity columns the line must carry. 'N' when nothing
             -- matches at all is not a fallback, it is the rule: track nothing.
             COALESCE(stp.stp_track_signature, 'N')            AS "trackSignature",

             -- Scoped to whatever of company / branch was given; with
             -- neither it means "opened anywhere".
             -- Aliased sml because unreversedLedgerRow expects that name
             -- (and a backtick here would end the template literal). ONE
             -- definition of "still counts" across the badge, the preflight
             -- and the post, so the screen cannot call a holding opened that
             -- the post would let through, or the reverse.
             EXISTS (SELECT 1
                       FROM stock.stock_ledger sml
                      WHERE (${companyId}::uuid IS NULL OR sml.sml_company_id = ${companyId}::uuid)
                        AND (${branchId}::uuid  IS NULL OR sml.sml_branch_id  = ${branchId}::uuid)
                        AND sml.sml_item_id  = i.item_id
                        AND sml.sml_txn_type = 'OPENING'
                        AND ${(0, stock_voucher_posting_helper_1.unreversedLedgerRow)()})          AS "alreadyOpened"

        FROM inventory.item_master i

        -- The keyed unit: the one asked for, or the item's default when none was.
        JOIN inventory.item_unit_conversion u
             ON u.iuc_item_id = i.item_id
            AND COALESCE(u.iuc_is_deleted, false) = false
            AND (u.iuc_id = ${uomId}::uuid
                 OR (${uomId}::uuid IS NULL AND u.iuc_is_default_unit = true))
        JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id

        -- The base unit, as a CONVERSION ROW. iuc_base_unit_id on the keyed
        -- row is a unit_id (item_unit_master); svi_base_uom_id is an iuc_id.
        -- Passing the pointer through does not store a nearly-right value, it
        -- fails fk_svi_base_uom. The factor is the keyed row's own; this join
        -- exists solely to turn base unit into base row, and is on the keyed
        -- row's own pointer rather than iuc_is_base_unit so that the factor
        -- and the base id always describe the same conversion.
        JOIN inventory.item_unit_conversion b
             ON b.iuc_item_id = i.item_id
            AND b.iuc_unit_id = u.iuc_base_unit_id
            AND COALESCE(b.iuc_is_deleted, false) = false

        -- LEFT: item_default_tax_id is nullable, and an item with no tax slab
        -- is still an item that can be opened.
        LEFT JOIN inventory.item_tax_master t ON t.tax_id = i.item_default_tax_id

        -- A null company or branch here matches only the policy rows that
        -- are themselves company-wide / branch-wide, which is the fragment's
        -- own "IS NULL OR =" shape doing the right thing unchanged.
        ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
            companyId: client_1.Prisma.sql `${companyId}::uuid`,
            branchId: client_1.Prisma.sql `${branchId}::uuid`,
            itemId: client_1.Prisma.raw('i.item_id'),
            itemGroupId: client_1.Prisma.raw('i.item_group_id'),
            onDate: client_1.Prisma.sql `${args.onDate}::date`,
        })}

       WHERE i.item_id = ${args.itemId}::uuid
         -- Both flags are NOT NULL on item_master, so the strict form is safe.
         AND i.item_is_active  = true
         AND i.item_is_deleted = false
         -- SCOPE THE ITEM TO THE COMPANY WHEN ONE IS GIVEN. Without this the
         -- lookup will happily fill a line from another company's item:
         -- /master-lookups/item-by-barcode takes no company at all, and on
         -- 192.168.0.106 a scan of 2323232323 resolved to another company's
         -- item which this lookup then returned in full (confirmed
         -- 2026-09-08).
         --
         -- When a company IS given the match is STRICT, not "= company OR
         -- IS NULL". A null company means something definite for
         -- stock_track_policy, stock_ageing_slab and stock_reason_master
         -- (shared with every company) and nothing at all for an item;
         -- treating it as shared here would invent a rule. When NO company is
         -- given (the parameter is null or empty) the predicate is off
         -- altogether — the caller asked for the item regardless of who owns it.
         AND (NULLIF(${companyId}::text, '') IS NULL
              OR i.item_company_id = ${companyId}::uuid)
         -- BRANCH, on the other hand, IS nullable-means-shared: 10,010 of the
         -- 10,041 live items carry no branch and belong to the whole company,
         -- 31 are branch-specific. With a branch given: this branch's own
         -- items plus the company-wide ones, never another branch's — the
         -- same shape fn_stp_effective uses for stp_branch_id. The asymmetry
         -- with the company predicate is deliberate. With no branch given the
         -- predicate is off, like the company one.
         AND (NULLIF(${branchId}::text, '') IS NULL
              OR i.item_branch_id IS NULL
              OR i.item_branch_id = ${branchId}::uuid)
         -- ONLY GOODS ENTER STOCK. item_is_service, NOT item_stock_type: that
         -- column reads 'FG' on 10,038 of 10,041 live items and carries no
         -- agreed vocabulary, so a predicate on it would exclude every real
         -- item in the database.
         AND COALESCE(i.item_is_service, false) = false
       LIMIT 1
    `;
        if (!row) {
            return this.throwWhyEmpty(args);
        }
        const seed = this.mrpPrices.isDeployed
            ? await this.mrpPrices.findOpeningSeedBucket({
                companyId,
                branchId,
                itemId: row.itemId,
                uomId: row.uomId,
                onDate: args.onDate,
            })
            : null;
        return {
            itemId: row.itemId,
            itemCode: row.itemCode,
            itemName: row.itemName,
            barcode: row.barcode,
            uomId: row.uomId,
            unitName: row.unitName,
            toBaseFactor: (0, module_service_utils_1.toNumber)(row.toBaseFactor),
            baseUomId: row.baseUomId,
            taxPerc: (0, module_service_utils_1.toNumber)(row.taxPerc),
            cessPerc: (0, module_service_utils_1.toNumber)(row.cessPerc),
            cessUnit: (0, module_service_utils_1.toNumber)(row.cessUnit),
            trackSignature: row.trackSignature,
            mrp: seed?.mrp ?? 0,
            salePrice: seed?.salePrice ?? 0,
            alreadyOpened: row.alreadyOpened,
        };
    }
    async throwWhyEmpty(args) {
        const uomId = args.uomId ?? null;
        const companyId = args.companyId ?? null;
        const branchId = args.branchId ?? null;
        const [cause] = await this.prisma.$queryRaw `
      SELECT i.item_is_active                                     AS "isActive",
             i.item_is_deleted                                    AS "isDeleted",
             i.item_company_id                                   AS "companyId",
             i.item_branch_id                                    AS "branchId",
             COALESCE(i.item_is_service, false)                  AS "isService",
             (SELECT count(*)::int
                FROM inventory.item_unit_conversion c
               WHERE c.iuc_item_id = i.item_id
                 AND COALESCE(c.iuc_is_deleted, false) = false)  AS "conversions",
             EXISTS (SELECT 1
                       FROM inventory.item_unit_conversion c
                      WHERE c.iuc_item_id = i.item_id
                        AND COALESCE(c.iuc_is_deleted, false) = false
                        AND c.iuc_is_default_unit = true)        AS "hasDefault",
             EXISTS (SELECT 1
                       FROM inventory.item_unit_conversion c
                      WHERE c.iuc_item_id = i.item_id
                        AND COALESCE(c.iuc_is_deleted, false) = false
                        AND c.iuc_id = ${uomId}::uuid)           AS "uomFound"
        FROM inventory.item_master i
       WHERE i.item_id = ${args.itemId}::uuid
    `;
        const notFound = (field, detail) => (0, module_service_utils_1.throwStockNotFound)('This item cannot be put on an opening line', field, detail);
        if (!cause || cause.isDeleted) {
            return notFound('itemId', 'No such item.');
        }
        if (!cause.isActive) {
            return notFound('itemId', 'This item is inactive; activate it on the item master first.');
        }
        if (companyId !== null && cause.companyId === null) {
            return notFound('itemId', 'This item has no company set, so no company can open it; set one on the item master.');
        }
        if (companyId !== null && cause.companyId !== companyId) {
            return notFound('itemId', 'This item belongs to another company.');
        }
        if (branchId !== null && cause.branchId !== null && cause.branchId !== branchId) {
            return notFound('itemId', 'This item belongs to another branch of the company.');
        }
        if (cause.isService) {
            return notFound('itemId', 'This is a service item; a service has no stock to open.');
        }
        if (cause.conversions === 0) {
            return notFound('itemId', 'This item has no unit conversion, so there is no unit to key it in; set one on the item master.');
        }
        if (uomId !== null && !cause.uomFound) {
            return notFound('uomId', "This unit is not one of the item's conversions.");
        }
        if (uomId === null && !cause.hasDefault) {
            return notFound('uomId', 'This item has no default unit; send uomId, or mark one of its conversions as the default.');
        }
        return notFound('uomId', "The unit's base unit has no conversion row of its own on this item; add it on the item master.");
    }
};
exports.OpeningStockLookupService = OpeningStockLookupService;
exports.OpeningStockLookupService = OpeningStockLookupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_mrp_price_gateway_1.StockMrpPriceGateway])
], OpeningStockLookupService);
//# sourceMappingURL=opening-stock-lookup.service.js.map