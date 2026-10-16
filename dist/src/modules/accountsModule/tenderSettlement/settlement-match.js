"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchLines = matchLines;
exports.isCustomerKind = isCustomerKind;
exports.kindTakes = kindTakes;
const client_1 = require("@prisma/client");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
const DAY_MS = 86_400_000;
function matchLines(lines, candidates, options) {
    const used = new Set(options.taken ?? []);
    const verdicts = new Map();
    const eligible = (line, c) => c.tenderId === line.tenderId && !used.has(`${line.kind}|${c.tdId}`) && kindTakes(line.kind, c);
    const take = (line, c, rule, status) => {
        used.add(`${line.kind}|${c.tdId}`);
        verdicts.set(line.aslId, {
            aslId: line.aslId,
            status,
            rule,
            tdId: c.tdId,
            tdAccYear: c.tdAccYear,
            diff: line.gross.minus(c.amount),
        });
    };
    const customerLines = lines.filter((l) => isCustomerKind(l.kind) && l.tenderId);
    for (const line of customerLines) {
        if (!line.refNo)
            continue;
        const ref = line.refNo.trim().toUpperCase();
        const hits = candidates
            .filter((c) => eligible(line, c) && c.refNo?.trim().toUpperCase() === ref)
            .filter((c) => line.gross.minus(c.amount).abs().lessThanOrEqualTo(options.tolerance));
        const best = closest(line, hits);
        if (best)
            take(line, best, tender_settlement_enum_1.SettlementMatchRule.REF, tender_settlement_enum_1.SettlementMatchStatus.MATCHED);
    }
    for (const line of customerLines) {
        if (verdicts.has(line.aslId) || !line.authCode || !line.cardLast4)
            continue;
        const auth = line.authCode.trim().toUpperCase();
        const hits = candidates.filter((c) => eligible(line, c) &&
            c.authCode?.trim().toUpperCase() === auth &&
            c.cardLast4 === line.cardLast4 &&
            c.amount.equals(line.gross) &&
            (line.txnOn === null || withinDays(line.txnOn, c.docDate, 1)));
        const best = closest(line, hits);
        if (best)
            take(line, best, tender_settlement_enum_1.SettlementMatchRule.AUTH, tender_settlement_enum_1.SettlementMatchStatus.MATCHED);
    }
    const open = customerLines.filter((l) => !verdicts.has(l.aslId) && l.txnOn);
    const windowMs = Math.max(0, options.windowMinutes) * 60_000;
    const options1 = new Map();
    for (const line of open) {
        options1.set(line.aslId, candidates.filter((c) => eligible(line, c) &&
            c.amount.equals(line.gross) &&
            Math.abs(c.createdOn.getTime() - line.txnOn.getTime()) <= windowMs));
    }
    const claims = new Map();
    for (const list of options1.values()) {
        for (const c of list)
            claims.set(c.tdId, (claims.get(c.tdId) ?? 0) + 1);
    }
    for (const line of open) {
        const list = options1.get(line.aslId) ?? [];
        if (list.length === 1 && claims.get(list[0].tdId) === 1 && eligible(line, list[0])) {
            take(line, list[0], tender_settlement_enum_1.SettlementMatchRule.AMOUNT_TIME, tender_settlement_enum_1.SettlementMatchStatus.SUGGESTED);
        }
    }
    return lines.map((line) => verdicts.get(line.aslId) ?? {
        aslId: line.aslId,
        status: tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED,
        rule: null,
        tdId: null,
        tdAccYear: null,
        diff: new client_1.Prisma.Decimal(0),
    });
}
function isCustomerKind(kind) {
    return (kind === tender_settlement_enum_1.SettlementLineKind.SALE ||
        kind === tender_settlement_enum_1.SettlementLineKind.REFUND ||
        kind === tender_settlement_enum_1.SettlementLineKind.CHARGEBACK);
}
function kindTakes(kind, c) {
    switch (kind) {
        case tender_settlement_enum_1.SettlementLineKind.SALE:
            return c.drCr === 'DR' && (c.settleStatus === 'PENDING' || c.settleStatus === 'PARTIAL');
        case tender_settlement_enum_1.SettlementLineKind.REFUND:
            return c.drCr === 'CR' && (c.settleStatus === 'PENDING' || c.settleStatus === 'PARTIAL');
        case tender_settlement_enum_1.SettlementLineKind.CHARGEBACK:
            return c.drCr === 'DR' && (c.settleStatus === 'SETTLED' || c.settleStatus === 'PARTIAL');
        default:
            return false;
    }
}
function closest(line, hits) {
    if (hits.length === 0)
        return null;
    return [...hits].sort((a, b) => {
        const da = line.gross.minus(a.amount).abs();
        const db = line.gross.minus(b.amount).abs();
        const byDiff = da.comparedTo(db);
        return byDiff !== 0 ? byDiff : a.createdOn.getTime() - b.createdOn.getTime();
    })[0];
}
function withinDays(on, docDate, days) {
    const doc = Date.parse(`${docDate}T00:00:00+05:30`);
    return on.getTime() >= doc - days * DAY_MS && on.getTime() < doc + (days + 1) * DAY_MS;
}
//# sourceMappingURL=settlement-match.js.map