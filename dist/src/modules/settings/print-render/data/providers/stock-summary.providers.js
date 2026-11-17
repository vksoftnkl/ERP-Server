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
exports.STOCK_SUMMARY_PRINT_PROVIDERS = exports.StockSummaryRowsProvider = exports.StockSummaryHeadProvider = exports.StockSummaryPrintSource = void 0;
exports.summaryHeadRow = summaryHeadRow;
exports.summaryPrintRow = summaryPrintRow;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../../../../database/prisma/prisma.service");
const stock_summary_query_dto_1 = require("../../../../stocks/reports/stock-summary/dto/stock-summary-query.dto");
const stock_summary_service_1 = require("../../../../stocks/reports/stock-summary/stock-summary.service");
const stock_summary_rules_1 = require("../../../../stocks/reports/stock-summary/stock-summary.rules");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(answers, name) {
    const value = answers[name];
    if (typeof value === 'number')
        return String(value);
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function flag(answers, name) {
    return typeof answers[name] === 'boolean' ? answers[name] : undefined;
}
function int(answers, name) {
    const v = answers[name];
    if (typeof v === 'number' && Number.isInteger(v))
        return v;
    if (typeof v === 'string' && /^\d+$/.test(v.trim()))
        return Number(v.trim());
    return undefined;
}
function viewPrompts(a) {
    return {
        hideZero: flag(a, 'hide_zero'),
        onlyNegative: flag(a, 'only_negative'),
        show: text(a, 'show')?.toUpperCase(),
        find: text(a, 'find'),
        sort: text(a, 'sort'),
        dir: text(a, 'dir')?.toLowerCase(),
        groupBy: text(a, 'group_by')?.toUpperCase(),
        groupKey: text(a, 'group_key'),
    };
}
function num(value) {
    if (value === null || value === undefined)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function dmy(iso) {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}
function istText(instant) {
    if (!instant)
        return '';
    const hh = Number(instant.slice(11, 13));
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${dmy(instant.slice(0, 10))} ${String(h12).padStart(2, '0')}:${instant.slice(14, 16)} ${hh < 12 ? 'AM' : 'PM'}`;
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
let StockSummaryPrintSource = class StockSummaryPrintSource {
    summary;
    prisma;
    constructor(summary, prisma) {
        this.summary = summary;
        this.prisma = prisma;
    }
    async query(request) {
        const a = request.params;
        const docCompany = request.context.docId && UUID.test(request.context.docId) ? request.context.docId : null;
        const plain = {
            companyId: docCompany ?? request.context.companyId,
            branchId: text(a, 'branch_id') ?? request.context.branchId ?? undefined,
            from: text(a, 'from_date'),
            to: text(a, 'to_date'),
            godownId: text(a, 'godown_id'),
            groupId: text(a, 'group_id'),
            brandId: text(a, 'brand_id'),
            bucket: text(a, 'bucket')?.toUpperCase(),
            valueAt: text(a, 'value_at')?.toUpperCase(),
            qtyIn: text(a, 'qty_in')?.toUpperCase(),
            noSaleDays: int(a, 'no_sale_days'),
            hideZero: flag(a, 'hide_zero'),
            onlyNegative: flag(a, 'only_negative'),
            show: text(a, 'show')?.toUpperCase(),
            ...viewPrompts(a),
        };
        for (const key of Object.keys(plain)) {
            if (plain[key] === undefined)
                delete plain[key];
        }
        if (plain.from === undefined && plain.to === undefined && text(a, 'run_id'))
            return null;
        const dto = (0, class_transformer_1.plainToInstance)(stock_summary_query_dto_1.StockSummaryQueryDto, plain);
        const problems = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (problems.length > 0) {
            const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
            throw new Error(`The print's filters are not what the Stock Summary takes: ${messages.join('; ')}`);
        }
        return dto;
    }
    async view(request) {
        const plain = viewPrompts(request.params);
        for (const key of Object.keys(plain)) {
            if (plain[key] === undefined)
                delete plain[key];
        }
        const dto = (0, class_transformer_1.plainToInstance)(stock_summary_query_dto_1.StockSummaryViewDto, plain);
        const problems = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (problems.length > 0) {
            const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
            throw new Error(`The print's filters are not what the Stock Summary takes: ${messages.join('; ')}`);
        }
        return dto;
    }
    async data(request) {
        const runId = text(request.params, 'run_id') ?? null;
        if (runId && !UUID.test(runId))
            throw new Error('The print’s run_id is not a run of the Stock Summary.');
        const query = await this.query(request);
        const view = await this.view(request);
        try {
            return await this.summary.printData({ runId: runId?.toLowerCase() ?? null, query, view });
        }
        catch (error) {
            throw new Error(refusalText(error));
        }
    }
    async printedBy(userId) {
        if (!userId || !UUID.test(userId))
            return null;
        const [user] = await this.prisma.$queryRaw `
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
        return user?.name ?? null;
    }
};
exports.StockSummaryPrintSource = StockSummaryPrintSource;
exports.StockSummaryPrintSource = StockSummaryPrintSource = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stock_summary_service_1.StockSummaryService,
        prisma_service_1.PrismaService])
], StockSummaryPrintSource);
let StockSummaryHeadProvider = class StockSummaryHeadProvider {
    source;
    code = 'reports.stock_summary.head';
    label = 'Stock Summary — heading, totals, transit and tie';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const [data, printedBy] = await Promise.all([
            this.source.data(request),
            this.source.printedBy(request.context.userId),
        ]);
        return summaryHeadRow(data, printedBy, new Date());
    }
};
exports.StockSummaryHeadProvider = StockSummaryHeadProvider;
exports.StockSummaryHeadProvider = StockSummaryHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [StockSummaryPrintSource])
], StockSummaryHeadProvider);
let StockSummaryRowsProvider = class StockSummaryRowsProvider {
    source;
    code = 'reports.stock_summary.rows';
    label = 'Stock Summary — one row per item, as the Item-wise grid';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const data = await this.source.data(request);
        return data.rows
            .slice(0, request.rowLimit)
            .map((row, i) => summaryPrintRow(row, i, data.head.todayOnly));
    }
};
exports.StockSummaryRowsProvider = StockSummaryRowsProvider;
exports.StockSummaryRowsProvider = StockSummaryRowsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [StockSummaryPrintSource])
], StockSummaryRowsProvider);
function summaryHeadRow(data, printedBy, at) {
    const h = data.head;
    const totals = data.totals;
    const t = data.transitOut;
    const tie = data.tie;
    const now = new Date(at.getTime() + 330 * 60_000).toISOString();
    return {
        title: 'STOCK SUMMARY',
        company_name: h.companyName,
        branch_name: h.branchName,
        printed_as: data.printedAs,
        period_text: `${dmy(h.from)} to ${dmy(h.to)}`,
        as_of_text: `as of ${istText(h.asOf)}`,
        bucket: h.bucket,
        value_at_text: h.valueAt === 'WITH_TAX' ? 'Cost with tax' : 'Cost without tax',
        qty_in_text: h.qtyIn === 'DEFAULT' ? 'Qty in default unit' : 'Qty in base unit',
        items_text: totals.rowsShown === totals.rows
            ? `${totals.rows} items`
            : `${totals.rowsShown} of ${totals.rows} items`,
        closing_value: num(totals.closingValue),
        opening_value: num(totals.openingValue),
        inward_value: num(totals.inwardValue),
        outward_value: num(totals.outwardValue),
        cost_adj: num(totals.costAdj),
        transit_out_text: t && t.transfers > 0
            ? `Sent from this branch, not received yet: ${t.items} item(s) on ${t.transfers} transfer(s), value ${t.value}`
            : '',
        tie_text: !tie?.checked
            ? 'Tie: only when To is today'
            : tie.differ === 0
                ? `= Stock now ✓ ${tie.equal} of ${tie.items} items`
                : `≠ Stock now on ${tie.differ} item(s)`,
        printed_at: istText(`${now.slice(0, 19)}+05:30`),
        printed_by: printedBy,
    };
}
function summaryPrintRow(row, index, todayOnly) {
    return {
        sl_no: index + 1,
        code: row.code,
        name: row.name,
        group: row.groupName,
        unit: row.unit.name,
        opening: num(row.opening),
        inward: num(row.inward),
        outward: num(row.outward),
        closing: num(row.closing),
        today_only: todayOnly,
        reserved: todayOnly ? num(row.reserved) : null,
        available: todayOnly ? num(row.available) : null,
        in_transit: todayOnly ? num(row.inTransit) : null,
        not_delivered: todayOnly ? num(row.notDelivered) : null,
        physical: todayOnly ? num(row.physical) : null,
        rate: num(row.rate),
        value: num(row.value),
        last_sale: dmy(row.lastSale),
        chips_text: (0, stock_summary_rules_1.chipsText)(row.chips),
        negative: row.chips.some((c) => c.kind === 'NEGATIVE'),
    };
}
exports.STOCK_SUMMARY_PRINT_PROVIDERS = [
    StockSummaryHeadProvider,
    StockSummaryRowsProvider,
];
//# sourceMappingURL=stock-summary.providers.js.map