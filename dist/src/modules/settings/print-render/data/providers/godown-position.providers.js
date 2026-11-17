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
exports.GODOWN_POSITION_PRINT_PROVIDERS = exports.GodownPositionRowsProvider = exports.GodownPositionHeadProvider = exports.GodownPositionPrintSource = void 0;
exports.positionHeadRow = positionHeadRow;
exports.positionPrintRow = positionPrintRow;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../../../../database/prisma/prisma.service");
const godown_position_query_dto_1 = require("../../../../stocks/reports/godown-position/dto/godown-position-query.dto");
const godown_position_service_1 = require("../../../../stocks/reports/godown-position/godown-position.service");
const print_text_utils_1 = require("./print-text.utils");
function text(a, name) {
    const v = a[name];
    if (typeof v === 'number')
        return String(v);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
function flag(a, name) {
    const v = a[name];
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string' && /^(true|false)$/i.test(v.trim()))
        return v.trim().toLowerCase() === 'true';
    return undefined;
}
function refusalText(error) {
    if (error instanceof common_1.HttpException) {
        const body = error.getResponse();
        if (typeof body === 'object' && body !== null) {
            const details = (body.errors ?? []).map((e) => e.message).filter(Boolean);
            if (details.length > 0)
                return details.join(' ');
        }
        return error.message;
    }
    return error instanceof Error ? error.message : String(error);
}
const BUCKET_TEXT = {
    SALEABLE: 'Saleable',
    DAMAGED: 'Damaged',
    QUARANTINE: 'Quarantine',
    EXPIRED: 'Expired',
    SAMPLE: 'Sample',
    ALL: 'All buckets',
};
const kgPart = (kg) => ((0, print_text_utils_1.decOf)(kg).isZero() ? '' : ` · ${(0, print_text_utils_1.qtyText)(kg)} kg`);
function positionHeadRow(data, printedBy, at) {
    const h = data.head;
    const t = data.tiles;
    const printedAt = (0, print_text_utils_1.istText)(at);
    return {
        company_name: h.companyName,
        branch_name: h.branchName,
        godown_text: h.godownName ?? 'All godowns',
        printed_as: data.printedAs,
        as_of_text: `as of ${h.asOf}`,
        qty_in_text: h.qtyIn === 'BASE' ? 'Qty in the base unit' : 'Qty in the selling unit',
        bucket_text: BUCKET_TEXT[h.bucket] ?? h.bucket,
        rows_count: data.totalRows,
        rows_text: (0, print_text_utils_1.countText)(data.totalRows, 'row'),
        physical_text: `${(0, print_text_utils_1.qtyText)(t.physical.pkgs)} pkgs${kgPart(t.physical.kg)}`,
        bnd_text: `${(0, print_text_utils_1.qtyText)(t.billedNotDelivered.pkgs)} pkgs${kgPart(t.billedNotDelivered.kg)}` +
            ` · ${(0, print_text_utils_1.countText)(t.billedNotDelivered.bills, 'bill')}`,
        owned_text: `${(0, print_text_utils_1.qtyText)(t.owned.pkgs)} pkgs${kgPart(t.owned.kg)}`,
        reserved_text: `${(0, print_text_utils_1.qtyText)(t.reserved.pkgs)} pkgs · ${(0, print_text_utils_1.countText)(t.reserved.items, 'item')}`,
        challan_text: `${(0, print_text_utils_1.qtyText)(t.challanOut.pkgs)} pkgs · ${(0, print_text_utils_1.countText)(t.challanOut.challans, 'challan')}`,
        short_text: t.short.items > 0
            ? `${(0, print_text_utils_1.countText)(t.short.items, 'item')} short` +
                (t.short.first ? ` (first: ${t.short.first.itemName} @ ${t.short.first.godownName ?? ''})` : '')
            : 'None short',
        short_items: t.short.items,
        physical_kg_text: (0, print_text_utils_1.qtyText)(data.totals.physicalKg),
        bnd_kg_text: (0, print_text_utils_1.qtyText)(data.totals.bndKg),
        owned_kg_text: (0, print_text_utils_1.qtyText)(data.totals.ownedKg),
        reserved_kg_text: (0, print_text_utils_1.qtyText)(data.totals.reservedKg),
        free_kg_text: (0, print_text_utils_1.qtyText)(data.totals.freeKg),
        challan_kg_text: (0, print_text_utils_1.qtyText)(data.totals.challanKg),
        tie_text: data.totals.tie
            ? 'Physical = Owned + Billed not delivered on every row'
            : 'Some rows do not tie (shown in red): check the delivery events',
        tie: data.totals.tie,
        printed_at: printedAt,
        printed_by: printedBy ?? '',
        printed_line: [`Printed ${printedAt}`, printedBy].filter(Boolean).join(' · '),
    };
}
const blankZero = (v) => ((0, print_text_utils_1.decOf)(v).isZero() ? '' : (0, print_text_utils_1.qtyText)(v));
function positionPrintRow(r, index) {
    const short = (0, print_text_utils_1.decOf)(r.short);
    const over = (0, print_text_utils_1.decOf)(r.overGiven);
    return {
        sl_no: index + 1,
        item_code: r.itemCode ?? '',
        item_name: r.itemName,
        godown_name: r.godownName ?? '',
        unit_name: r.unitName,
        physical: (0, print_text_utils_1.numOf)(r.physical),
        physical_text: (0, print_text_utils_1.qtyText)(r.physical),
        bnd: (0, print_text_utils_1.numOf)(r.billedNotDelivered),
        bnd_text: blankZero(r.billedNotDelivered),
        owned: (0, print_text_utils_1.numOf)(r.owned),
        owned_text: (0, print_text_utils_1.qtyText)(r.owned),
        reserved_text: blankZero(r.reserved),
        free_text: (0, print_text_utils_1.qtyText)(r.freeToSell),
        challan_text: blankZero(r.challanOut),
        physical_kg_text: blankZero(r.physicalKg),
        short_text: short.isZero() ? '' : `SHORT ${(0, print_text_utils_1.qtyText)(short)}`,
        over_text: over.isZero() ? '' : `over-given ${(0, print_text_utils_1.qtyText)(over)}`,
        flags_text: [short.isZero() ? null : `SHORT ${(0, print_text_utils_1.qtyText)(short)}`, over.isZero() ? null : `over-given ${(0, print_text_utils_1.qtyText)(over)}`, r.tie ? null : 'does not tie']
            .filter(Boolean)
            .join(' · '),
        is_short: !short.isZero(),
        is_red: !short.isZero() || !over.isZero() || !r.tie,
        tie: r.tie,
        last_given_text: r.lastGiven ? `${r.lastGiven.refno ?? 'go-live'} · ${(0, print_text_utils_1.dmyText)(r.lastGiven.date)}` : '',
        count_note: (0, print_text_utils_1.decOf)(r.billedNotDelivered).isZero()
            ? ''
            : `incl. ${(0, print_text_utils_1.qtyText)(r.billedNotDelivered)} billed, not yet given`,
    };
}
let GodownPositionPrintSource = class GodownPositionPrintSource {
    position;
    prisma;
    runs = new print_text_utils_1.RenderMemo();
    constructor(position, prisma) {
        this.position = position;
        this.prisma = prisma;
    }
    async query(request) {
        const a = request.params;
        const plain = {
            companyId: request.context.companyId,
            branchId: text(a, 'branch_id') ?? request.context.branchId ?? undefined,
            godownId: text(a, 'godown_id'),
            groupId: text(a, 'group_id'),
            brandId: text(a, 'brand_id'),
            qtyIn: text(a, 'qty_in')?.toUpperCase(),
            bucket: text(a, 'bucket')?.toUpperCase(),
            onlyToGive: flag(a, 'only_to_give'),
            hideZero: flag(a, 'hide_zero'),
            find: text(a, 'find'),
        };
        for (const key of Object.keys(plain)) {
            if (plain[key] === undefined)
                delete plain[key];
        }
        const dto = (0, class_transformer_1.plainToInstance)(godown_position_query_dto_1.GodownPositionQueryDto, plain);
        const problems = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (problems.length > 0) {
            const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
            throw new Error(`The print's filters are not what the Godown Stock Position takes: ${messages.join('; ')}`);
        }
        return dto;
    }
    async data(request) {
        const q = await this.query(request);
        const key = JSON.stringify([q, request.context.userId]);
        return this.runs.get(key, async () => {
            try {
                return await this.position.printData(q, request.context.userId);
            }
            catch (error) {
                throw new Error(refusalText(error));
            }
        });
    }
    async printedBy(userId) {
        if (!userId || !print_text_utils_1.UUID.test(userId))
            return null;
        const [user] = await this.prisma.$queryRaw `
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
        return user?.name ?? null;
    }
};
exports.GodownPositionPrintSource = GodownPositionPrintSource;
exports.GodownPositionPrintSource = GodownPositionPrintSource = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [godown_position_service_1.GodownPositionService,
        prisma_service_1.PrismaService])
], GodownPositionPrintSource);
let GodownPositionHeadProvider = class GodownPositionHeadProvider {
    source;
    code = 'reports.godown_position.head';
    label = 'Godown Stock Position — heading, tiles, kg totals and tie';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const [data, printedBy] = await Promise.all([
            this.source.data(request),
            this.source.printedBy(request.context.userId),
        ]);
        return positionHeadRow(data, printedBy, new Date());
    }
};
exports.GodownPositionHeadProvider = GodownPositionHeadProvider;
exports.GodownPositionHeadProvider = GodownPositionHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [GodownPositionPrintSource])
], GodownPositionHeadProvider);
let GodownPositionRowsProvider = class GodownPositionRowsProvider {
    source;
    code = 'reports.godown_position.rows';
    label = 'Godown Stock Position — one row per item × godown, as the grid (also the count sheet)';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const data = await this.source.data(request);
        return data.rows.slice(0, request.rowLimit).map((row, i) => positionPrintRow(row, i));
    }
};
exports.GodownPositionRowsProvider = GodownPositionRowsProvider;
exports.GodownPositionRowsProvider = GodownPositionRowsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [GodownPositionPrintSource])
], GodownPositionRowsProvider);
exports.GODOWN_POSITION_PRINT_PROVIDERS = [
    GodownPositionHeadProvider,
    GodownPositionRowsProvider,
];
//# sourceMappingURL=godown-position.providers.js.map