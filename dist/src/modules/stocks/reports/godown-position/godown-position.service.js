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
exports.GodownPositionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../../common/request-context/request-context.service");
const rights_1 = require("../../../../common/posting/rights");
const module_shared_utils_1 = require("../../../../common/utils/module-shared.utils");
const godown_position_sql_1 = require("./godown-position.sql");
const godown_position_rules_1 = require("./godown-position.rules");
const godown_position_types_1 = require("./types/godown-position.types");
const TX_OPTIONS = {
    isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: 60_000,
};
let GodownPositionService = class GodownPositionService {
    prisma;
    requestContext;
    constructor(prisma, requestContext) {
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async show(q) {
        const rights = await this.assertRight('view', 'open the Godown Stock Position');
        const built = await this.build(q);
        return {
            head: built.head,
            tiles: (0, godown_position_rules_1.tilesOf)(built.rows),
            rows: built.rows.map((r) => r.wire),
            totals: (0, godown_position_rules_1.totalsOf)(built.rows),
            rights: rightsOf(rights),
        };
    }
    async export(q) {
        const rights = await this.assertRight('view', 'open the Godown Stock Position');
        this.assertAlso(rights, 'export', 'export the Godown Stock Position');
        const built = await this.build(q);
        return {
            head: built.head,
            printedAs: (0, godown_position_rules_1.printedAsOf)({
                branchName: built.head.branchName,
                godownName: built.head.godownName,
                groupName: built.head.groupName,
                brandName: built.head.brandName,
                asOf: built.head.asOf,
                qtyIn: built.head.qtyIn,
                bucket: built.head.bucket,
                onlyToGive: built.head.onlyToGive,
                hideZero: built.head.hideZero,
                find: built.head.find,
            }),
            tiles: (0, godown_position_rules_1.tilesOf)(built.rows),
            rows: built.rows.map((r) => r.wire),
            totals: (0, godown_position_rules_1.totalsOf)(built.rows),
            totalRows: built.rows.length,
        };
    }
    async behind(q) {
        await this.assertRight('view', 'open the Godown Stock Position');
        const mode = q.qtyIn ?? 'SELLING';
        const bucket = q.bucket ?? 'SALEABLE';
        return this.snapshot(async (db) => {
            const row = await this.lookup(db, { ...q, groupId: undefined, brandId: undefined }, q.itemId);
            const s = this.scopeOf(q.companyId, q.branchId, q.godownId, bucket, null, null);
            const [fact] = await db.$queryRaw((0, godown_position_sql_1.itemFactsSql)([q.itemId]));
            const unit = (0, godown_position_rules_1.unitOf)(fact, mode);
            const lots = (0, godown_position_rules_1.byLotOf)(await db.$queryRaw((0, godown_position_sql_1.byLotSql)(s, q.itemId)), unit.factor);
            let total = (0, godown_position_rules_1.dec)(0);
            let rows;
            if (q.kind === 'BND') {
                const bills = await db.$queryRaw((0, godown_position_sql_1.behindBillsSql)(s, q.itemId));
                for (const b of bills)
                    total = total.plus((0, godown_position_rules_1.dec)(b.pending_base));
                rows = (0, godown_position_rules_1.behindBillRows)(bills, unit.factor);
            }
            else {
                const dcs = await db.$queryRaw((0, godown_position_sql_1.behindChallansSql)(s, q.itemId));
                for (const d of dcs)
                    total = total.plus((0, godown_position_rules_1.dec)(d.open_base));
                rows = (0, godown_position_rules_1.behindChallanRows)(dcs, unit.factor);
            }
            return {
                kind: q.kind,
                itemId: q.itemId,
                itemName: fact?.item_name ?? '',
                godownId: q.godownId,
                godownName: row.gdl_name,
                unitName: unit.name,
                unitFactor: unit.factor.toFixed(6),
                rows,
                total: (0, godown_position_rules_1.qtyIn)(total, unit.factor),
                byLot: lots.byLot,
                sum: lots.sum,
            };
        });
    }
    async build(q) {
        const mode = q.qtyIn ?? 'SELLING';
        const bucket = q.bucket ?? 'SALEABLE';
        const hideZero = q.hideZero ?? true;
        const onlyToGive = q.onlyToGive ?? false;
        const find = (q.find ?? '').trim();
        return this.snapshot(async (db) => {
            const row = await this.lookup(db, q);
            const m = await this.moment(db);
            const s = this.scopeOf(q.companyId, q.branchId, q.godownId ?? null, bucket, q.groupId ?? null, q.brandId ?? null);
            const dbRows = await db.$queryRaw((0, godown_position_sql_1.positionSql)(s));
            const items = [...new Set(dbRows.map((r) => r.item_id))];
            const facts = items.length ? await db.$queryRaw((0, godown_position_sql_1.itemFactsSql)(items)) : [];
            const godownRows = await db.$queryRaw `
        SELECT gdl_id, gdl_name, gdl_sort FROM inventory.godown_locations
         WHERE gdl_branch_id = ${q.branchId}::uuid
            OR gdl_id = ANY(${[...new Set(dbRows.map((r) => r.godown_id))]}::uuid[])`;
            const godowns = new Map(godownRows.map((g) => [
                g.gdl_id,
                { name: g.gdl_name, sort: g.gdl_sort === null ? Number.MAX_SAFE_INTEGER : Number(g.gdl_sort) },
            ]));
            const rows = (0, godown_position_rules_1.sortRows)((0, godown_position_rules_1.filterRows)((0, godown_position_rules_1.buildRows)({ rows: dbRows, facts, godowns, qtyIn: mode }), {
                hideZero,
                onlyToGive,
                find,
            }));
            const head = {
                companyId: q.companyId,
                companyName: row.comp_name,
                branchId: q.branchId,
                branchName: row.br_name,
                godownId: q.godownId ?? null,
                godownName: q.godownId ? row.gdl_name : null,
                groupId: q.groupId ?? null,
                groupName: q.groupId ? row.itg_name : null,
                brandId: q.brandId ?? null,
                brandName: q.brandId ? row.brand_name : null,
                asOf: m.asOf,
                today: m.today,
                qtyIn: mode,
                bucket,
                onlyToGive,
                hideZero,
                find,
            };
            return { head, rows };
        });
    }
    scopeOf(companyId, branchId, godownId, bucket, groupId, brandId) {
        return {
            companyId,
            branchId,
            godownId,
            bucket: bucket === 'ALL' ? null : bucket,
            groupId,
            brandId,
        };
    }
    assertRight(right, action) {
        return (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: godown_position_types_1.GODOWN_POSITION_MENU_ID,
            right,
            codePrefix: godown_position_types_1.GODOWN_POSITION_CODE_PREFIX,
            action,
        });
    }
    assertAlso(rights, right, action) {
        if (rights[right])
            return;
        const message = `This user may not ${action} (menu ${godown_position_types_1.GODOWN_POSITION_MENU_ID}: ` +
            `${rights_1.RIGHT_COLUMN[right]} is not granted)`;
        (0, module_shared_utils_1.throwForbidden)(message, [
            { field: 'userId', message, code: `${godown_position_types_1.GODOWN_POSITION_CODE_PREFIX}_RIGHT_${right.toUpperCase()}` },
        ]);
    }
    snapshot(work) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET TRANSACTION READ ONLY`;
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            await tx.$executeRaw `SET LOCAL jit = off`;
            return work(tx);
        }, TX_OPTIONS);
    }
    async moment(db) {
        const [row] = await db.$queryRaw `
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d,
             to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY HH12:MI AM') AS at`;
        return { today: row.d, asOf: row.at };
    }
    async lookup(db, q, itemId = null) {
        const [row] = await db.$queryRaw `
      SELECT b.br_comp_id, b.br_name, b.br_is_deleted, c.comp_name,
             g.gdl_branch_id, g.gdl_name, g.gdl_is_deleted,
             gr.itg_id, gr.itg_name, gr.itg_is_deleted,
             bd.brand_id, bd.brand_name, bd.brand_is_deleted,
             i.item_id, i.item_company_id, i.item_is_deleted
        FROM (SELECT 1) x
        LEFT JOIN public.branch_master b ON b.br_id = ${q.branchId}::uuid
        LEFT JOIN public.companys c ON c.comp_id = ${q.companyId}::uuid
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = ${q.godownId ?? null}::uuid
        LEFT JOIN inventory.item_group_master gr ON gr.itg_id = ${q.groupId ?? null}::uuid
        LEFT JOIN inventory.item_brand_master bd ON bd.brand_id = ${q.brandId ?? null}::uuid
        LEFT JOIN inventory.item_master i ON i.item_id = ${itemId}::uuid`;
        if (!row.br_comp_id || row.br_comp_id !== q.companyId || row.br_is_deleted === true) {
            refuse(godown_position_types_1.GODOWN_POSITION_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'That branch is not part of this company.');
        }
        if (q.godownId && (row.gdl_branch_id !== q.branchId || row.gdl_is_deleted === true)) {
            refuse(godown_position_types_1.GODOWN_POSITION_ERROR.GODOWN_NOT_IN_BRANCH, 'godownId', `Godown ${row.gdl_name ?? q.godownId} is not a godown of ${row.br_name ?? 'this branch'}.`, { godown: row.gdl_name ?? 'That godown', branch: row.br_name ?? 'this branch' });
        }
        if (q.groupId && (!row.itg_id || row.itg_is_deleted === true)) {
            refuse(godown_position_types_1.GODOWN_POSITION_ERROR.GROUP_NOT_FOUND, 'groupId', 'That item group is not there now.');
        }
        if (q.brandId && (!row.brand_id || row.brand_is_deleted === true)) {
            refuse(godown_position_types_1.GODOWN_POSITION_ERROR.BRAND_NOT_FOUND, 'brandId', 'That brand is not there now.');
        }
        if (itemId && (!row.item_id || row.item_is_deleted === true)) {
            refuse(godown_position_types_1.GODOWN_POSITION_ERROR.ITEM_NOT_FOUND, 'itemId', 'This item is not there now.');
        }
        return row;
    }
};
exports.GodownPositionService = GodownPositionService;
exports.GodownPositionService = GodownPositionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], GodownPositionService);
function refuse(code, field, message, params) {
    (0, module_shared_utils_1.throwUnprocessable)('Godown Stock Position request refused', [
        { field, message, code, ...(params ? { params } : {}) },
    ]);
}
function rightsOf(rights) {
    return { view: rights.view, print: rights.print, export: rights.export };
}
//# sourceMappingURL=godown-position.service.js.map