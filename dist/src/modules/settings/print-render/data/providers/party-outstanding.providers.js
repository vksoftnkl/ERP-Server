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
exports.PARTY_OUTSTANDING_PRINT_PROVIDERS = exports.PartyOutstandingPartiesProvider = exports.PartyOutstandingHeadProvider = exports.PartyOutstandingPrintSource = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../../../../database/prisma/prisma.service");
const party_outstanding_query_dto_1 = require("../../../../reports/party-outstanding/dto/party-outstanding-query.dto");
const party_outstanding_ageing_1 = require("../../../../reports/party-outstanding/party-outstanding.ageing");
const party_outstanding_service_1 = require("../../../../reports/party-outstanding/party-outstanding.service");
const format_1 = require("../../engine/expression/transforms/format");
const MAX_BUCKET_SLOTS = 8;
function text(answers, name) {
    const value = answers[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function flag(answers, name) {
    return typeof answers[name] === 'boolean' ? answers[name] : undefined;
}
function whole(answers, name) {
    return typeof answers[name] === 'number' ? answers[name] : undefined;
}
function amount(value) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}
function money(value) {
    return (0, format_1.formatNumber)(value, '##,##,##0.00');
}
function sideText(bal) {
    return bal.side === 'DR' ? 'Dr' : bal.side === 'CR' ? 'Cr' : '';
}
function dmy(iso) {
    return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '';
}
function flagLabel(flagValue, lastEdge) {
    switch (flagValue) {
        case 'CHQ_BOUNCED':
            return 'CHQ BOUNCED';
        case 'OVER_180':
            return lastEdge === undefined ? 'OLDEST BUCKET' : `> ${lastEdge} DAYS`;
        case 'ADVANCE':
            return 'ADVANCE';
        case 'OVER_LIMIT':
            return 'OVER LIMIT';
        default:
            return String(flagValue);
    }
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
let PartyOutstandingPrintSource = class PartyOutstandingPrintSource {
    outstanding;
    prisma;
    constructor(outstanding, prisma) {
        this.outstanding = outstanding;
        this.prisma = prisma;
    }
    async query(request) {
        const a = request.params;
        const plain = {
            companyId: request.context.companyId,
            shape: 'PARTIES',
            asOn: text(a, 'as_on'),
            side: text(a, 'side')?.toUpperCase(),
            branchId: text(a, 'filter_branch_id'),
            groupId: text(a, 'group_id'),
            areaId: text(a, 'area_id'),
            salesmanId: text(a, 'salesman_id'),
            collectionDay: text(a, 'collection_day'),
            partyId: text(a, 'party_id'),
            ageBy: text(a, 'age_by')?.toUpperCase(),
            buckets: text(a, 'buckets'),
            onlyOverdue: flag(a, 'only_overdue'),
            includeOnAccount: flag(a, 'include_on_account'),
            deductPdc: flag(a, 'deduct_pdc'),
            hideZero: flag(a, 'hide_zero'),
            minDueDays: whole(a, 'min_due_days'),
            maxDueDays: whole(a, 'max_due_days'),
            sort: text(a, 'sort'),
            dir: text(a, 'dir')?.toLowerCase(),
        };
        for (const key of Object.keys(plain)) {
            if (plain[key] === undefined)
                delete plain[key];
        }
        const dto = (0, class_transformer_1.plainToInstance)(party_outstanding_query_dto_1.OutstandingExportDto, plain);
        const problems = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (problems.length > 0) {
            const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
            throw new Error(`The print's filters are not what Party-wise Outstanding takes: ${messages.join('; ')}`);
        }
        return dto;
    }
    async parties(request) {
        const q = await this.query(request);
        try {
            const data = (await this.outstanding.export(q));
            return { q, data };
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
exports.PartyOutstandingPrintSource = PartyOutstandingPrintSource;
exports.PartyOutstandingPrintSource = PartyOutstandingPrintSource = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [party_outstanding_service_1.PartyOutstandingService,
        prisma_service_1.PrismaService])
], PartyOutstandingPrintSource);
let PartyOutstandingHeadProvider = class PartyOutstandingHeadProvider {
    source;
    code = 'reports.party_outstanding.head';
    label = 'Party-wise Outstanding — heading, totals and tiles';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const [{ q, data }, printedBy] = await Promise.all([
            this.source.parties(request),
            this.source.printedBy(request.context.userId),
        ]);
        const { totals, tiles } = data;
        const receivable = data.side === 'RECEIVABLE';
        const now = new Date(Date.now() + 330 * 60_000).toISOString();
        const head = {
            company_name: data.companyName,
            branch_name: data.branchName,
            branch_label: data.branchName ?? 'All branches',
            printed_as: data.printedAs,
            side: data.side,
            side_word: receivable ? 'Receivable' : 'Payable',
            title: receivable
                ? 'PARTY-WISE OUTSTANDING — RECEIVABLES'
                : 'PARTY-WISE OUTSTANDING — PAYABLES',
            as_on: data.asOn,
            as_on_text: dmy(data.asOn),
            acc_year: data.accYear,
            is_future: data.isFuture,
            age_by_text: (q.ageBy ?? 'BILL_DATE') === 'DUE_DATE' ? 'Aged by due date' : 'Aged by bill date',
            bucket_count: data.bucketLabels.length,
            parties: data.totalRows,
            bills: totals.bills,
            owed: amount(totals.owed),
            on_account: amount(totals.onAccount),
            net_amt: amount(totals.net.amount),
            net_side: sideText(totals.net),
            overdue: amount(totals.overdue),
            pdc_in_hand: amount(totals.pdcInHand),
            overdue_pct: tiles.overduePctOfOwed,
            above_days: tiles.aboveDays.days,
            above_amount: amount(tiles.aboveDays.amount),
            above_parties: tiles.aboveDays.parties,
            pdc_amount: amount(tiles.pdcInHand.amount),
            pdc_cheques: tiles.pdcInHand.cheques,
            deduct_pdc: q.deductPdc ?? false,
            due_next_days: tiles.dueNext.days,
            due_next_amount: amount(tiles.dueNext.amount),
            due_next_from_text: dmy(tiles.dueNext.from),
            due_next_to_text: dmy(tiles.dueNext.to),
            printed_at: `${dmy(now.slice(0, 10))} ${now.slice(11, 16)}`,
            printed_by: printedBy,
        };
        for (let i = 0; i < MAX_BUCKET_SLOTS; i += 1) {
            head[`label_${i}`] = data.bucketLabels[i] ?? '';
            head[`bucket_${i}`] = i < totals.buckets.length ? amount(totals.buckets[i]) : null;
        }
        return head;
    }
};
exports.PartyOutstandingHeadProvider = PartyOutstandingHeadProvider;
exports.PartyOutstandingHeadProvider = PartyOutstandingHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [PartyOutstandingPrintSource])
], PartyOutstandingHeadProvider);
let PartyOutstandingPartiesProvider = class PartyOutstandingPartiesProvider {
    source;
    code = 'reports.party_outstanding.parties';
    label = 'Party-wise Outstanding — one row per party';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        const { q, data } = await this.source.parties(request);
        const edges = (0, party_outstanding_ageing_1.parseBuckets)(q.buckets) ?? [...party_outstanding_ageing_1.DEFAULT_BUCKETS];
        const lastEdge = edges[edges.length - 1];
        return data.rows
            .slice(0, request.rowLimit)
            .map((row, index) => toRow(row, index, data.bucketLabels, lastEdge));
    }
};
exports.PartyOutstandingPartiesProvider = PartyOutstandingPartiesProvider;
exports.PartyOutstandingPartiesProvider = PartyOutstandingPartiesProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [PartyOutstandingPrintSource])
], PartyOutstandingPartiesProvider);
function toRow(row, index, labels, lastEdge) {
    const flags = row.flags.map((f) => flagLabel(f, lastEdge)).join(' · ');
    const ageing = row.buckets
        .map((value, i) => (amount(value) !== 0 ? `${labels[i]} ${money(value)}` : null))
        .filter(Boolean)
        .join(' · ');
    const out = {
        sl_no: index + 1,
        party_id: row.partyId,
        name: row.name,
        area: row.area,
        phone: row.phone,
        credit_days: row.creditDays,
        credit_limit: row.creditLimit === null ? null : amount(row.creditLimit),
        bills: row.bills,
        owed: amount(row.owed),
        on_account: amount(row.onAccount),
        net_amt: amount(row.net.amount),
        net_side: sideText(row.net),
        overdue: amount(row.overdue),
        oldest_days: row.oldestDays,
        pdc_in_hand: amount(row.pdcInHand),
        flags_text: flags || null,
        ageing_text: ageing || null,
        sub_text: [
            row.area,
            row.phone ? `Ph ${row.phone}` : null,
            row.creditDays ? `${row.creditDays} days credit` : null,
            flags || null,
            ageing ? `Ageing: ${ageing}` : null,
            amount(row.pdcInHand) !== 0 ? `PDC in hand ${money(row.pdcInHand)}` : null,
        ]
            .filter(Boolean)
            .join(' · ') || null,
    };
    for (let i = 0; i < MAX_BUCKET_SLOTS; i += 1) {
        out[`bucket_${i}`] = i < row.buckets.length ? amount(row.buckets[i]) : null;
    }
    return out;
}
exports.PARTY_OUTSTANDING_PRINT_PROVIDERS = [
    PartyOutstandingHeadProvider,
    PartyOutstandingPartiesProvider,
];
//# sourceMappingURL=party-outstanding.providers.js.map