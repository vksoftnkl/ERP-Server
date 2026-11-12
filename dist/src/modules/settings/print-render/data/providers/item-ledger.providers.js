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
exports.ITEM_LEDGER_PRINT_PROVIDERS = exports.ItemLedgerRowsProvider = exports.ItemLedgerHeadProvider = exports.ItemLedgerPrintSource = void 0;
exports.headRow = headRow;
exports.ledgerPrintRow = ledgerPrintRow;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../../../../database/prisma/prisma.service");
const item_ledger_query_dto_1 = require("../../../../stocks/reports/item-ledger/dto/item-ledger-query.dto");
const item_ledger_service_1 = require("../../../../stocks/reports/item-ledger/item-ledger.service");
function text(answers, name) {
    const value = answers[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function flag(answers, name) {
    return typeof answers[name] === 'boolean' ? answers[name] : undefined;
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
function refusalText(error) {
    if (error instanceof common_1.HttpException) {
        const body = error.getResponse();
        if (typeof body === 'object' && body !== null) {
            const nested = typeof body.message === 'object' && body.message !== null
                ? body.message.errors
                : undefined;
            const details = (body.errors ?? nested ?? []).map((e) => e.message).filter(Boolean);
            if (details.length > 0)
                return details.join(' ');
        }
        return error.message;
    }
    return error instanceof Error ? error.message : String(error);
}
let ItemLedgerPrintSource = class ItemLedgerPrintSource {
    ledger;
    prisma;
    constructor(ledger, prisma) {
        this.ledger = ledger;
        this.prisma = prisma;
    }
    async query(request) {
        const a = request.params;
        const plain = {
            companyId: request.context.companyId,
            branchId: text(a, 'branch_id') ?? request.context.branchId ?? undefined,
            itemId: text(a, 'item_id'),
            from: text(a, 'from_date'),
            to: text(a, 'to_date'),
            godownId: text(a, 'godown_id'),
            bucket: text(a, 'bucket')?.toUpperCase(),
            lotId: text(a, 'lot_id'),
            types: text(a, 'types'),
            unitId: text(a, 'unit_id'),
            valueAt: text(a, 'value_at')?.toUpperCase(),
            showReversed: flag(a, 'show_reversed'),
            order: text(a, 'order')?.toLowerCase(),
        };
        for (const key of Object.keys(plain)) {
            if (plain[key] === undefined)
                delete plain[key];
        }
        const dto = (0, class_transformer_1.plainToInstance)(item_ledger_query_dto_1.ItemLedgerExportDto, plain);
        const problems = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (problems.length > 0) {
            const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
            throw new Error(`The print's filters are not what the Item Ledger takes: ${messages.join('; ')}`);
        }
        return dto;
    }
    async rows(request) {
        const q = await this.query(request);
        try {
            return await this.ledger.export(q);
        }
        catch (error) {
            throw new Error(refusalText(error));
        }
    }
    async printedBy(userId) {
        if (!userId || !/^[0-9a-f-]{36}$/i.test(userId))
            return null;
        const [user] = await this.prisma.$queryRaw `
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
        return user?.name ?? null;
    }
};
exports.ItemLedgerPrintSource = ItemLedgerPrintSource;
exports.ItemLedgerPrintSource = ItemLedgerPrintSource = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [item_ledger_service_1.ItemLedgerService,
        prisma_service_1.PrismaService])
], ItemLedgerPrintSource);
let ItemLedgerHeadProvider = class ItemLedgerHeadProvider {
    source;
    code = 'reports.item_ledger.head';
    label = 'Item Ledger — heading, opening, totals and closing';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const [data, printedBy] = await Promise.all([
            this.source.rows(request),
            this.source.printedBy(request.context.userId),
        ]);
        return headRow(data, printedBy, new Date());
    }
};
exports.ItemLedgerHeadProvider = ItemLedgerHeadProvider;
exports.ItemLedgerHeadProvider = ItemLedgerHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ItemLedgerPrintSource])
], ItemLedgerHeadProvider);
let ItemLedgerRowsProvider = class ItemLedgerRowsProvider {
    source;
    code = 'reports.item_ledger.rows';
    label = 'Item Ledger — one row per voucher line group, posting order';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const data = await this.source.rows(request);
        return data.rows.slice(0, request.rowLimit).map((row, i) => ledgerPrintRow(row, i));
    }
};
exports.ItemLedgerRowsProvider = ItemLedgerRowsProvider;
exports.ItemLedgerRowsProvider = ItemLedgerRowsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ItemLedgerPrintSource])
], ItemLedgerRowsProvider);
function headRow(data, printedBy, at) {
    const h = data.head;
    const now = new Date(at.getTime() + 330 * 60_000).toISOString();
    const hh = Number(now.slice(11, 13));
    const time = `${String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, '0')}:${now.slice(14, 16)} ${hh < 12 ? 'AM' : 'PM'}`;
    return {
        title: 'ITEM LEDGER',
        company_name: h.companyName,
        branch_name: h.branchName,
        item_code: h.itemCode,
        item_name: h.itemName,
        item_label: [h.itemCode, h.itemName].filter(Boolean).join(' · '),
        printed_as: data.printedAs,
        from_date: h.from,
        to_date: h.to,
        from_text: dmy(h.from),
        to_text: dmy(h.to),
        period_text: `${dmy(h.from)} to ${dmy(h.to)}`,
        godown_name: h.godownName ?? 'All godowns',
        bucket: h.bucket,
        batch_no: h.batchNo,
        unit_name: h.unit.name,
        value_at_text: h.valueAt === 'WITH_TAX' ? 'Cost with tax' : 'Cost without tax',
        opening_text: `Opening balance · closing of ${dmy(data.opening.closingOf)}`,
        opening_qty: num(data.opening.qty),
        opening_value: num(data.opening.value),
        opening_rate: num(data.opening.rate),
        opening_lots: data.opening.lots,
        received_qty: num(data.totals.receivedQty),
        issued_qty: num(data.totals.issuedQty),
        value_in: num(data.totals.valueIn),
        value_out: num(data.totals.valueOut),
        rows: data.totals.rows,
        rows_shown: data.totals.rowsShown,
        docs: data.totals.docs,
        reversed_pairs: data.totals.reversedPairs,
        rows_note: data.totals.rowsShown === data.totals.rows
            ? `${data.totals.rows} rows`
            : `${data.totals.rowsShown} of ${data.totals.rows} rows (filtered)`,
        closing_text: `Closing · ${dmy(data.closing.date)}`,
        closing_qty: num(data.closing.qty),
        closing_value: num(data.closing.value),
        closing_rate: num(data.closing.rate),
        printed_at: `${dmy(now.slice(0, 10))} ${time}`,
        printed_by: printedBy,
    };
}
function ledgerPrintRow(row, index) {
    const internal = row.kind === 'INTERNAL';
    const chip = row.state === 'LIVE' ? '' : row.state === 'REVERSAL' ? 'REVERSAL' : row.state;
    const party = [row.party?.label, row.detail].filter((v) => v && v.trim()).join(' · ');
    return {
        sl_no: index + 1,
        seq: row.seq,
        date_text: dmy(row.date),
        time: row.time,
        type_label: row.typeLabel,
        state: row.state,
        state_chip: chip,
        greyed: row.state !== 'LIVE',
        doc_no: row.docNo,
        party_detail: party || null,
        godown: internal && row.toGodownName
            ? `${row.godownName ?? ''} → ${row.toGodownName}`
            : row.godownName,
        batch_no: row.batchNo,
        received_qty: num(row.receivedQty),
        issued_qty: num(row.issuedQty),
        moved_text: internal && row.movedQty !== null ? `${row.movedQty} ↔ internal` : null,
        balance_qty: num(row.balanceQty),
        cost_rate: num(row.costRate),
        cost_value: num(row.costValue),
        doc_rate: num(row.docRate),
        user: row.user,
    };
}
exports.ITEM_LEDGER_PRINT_PROVIDERS = [
    ItemLedgerHeadProvider,
    ItemLedgerRowsProvider,
];
//# sourceMappingURL=item-ledger.providers.js.map