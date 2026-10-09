"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTION_DAYS = exports.NOT_DUE_LABEL = exports.MAX_BUCKET_DAYS = exports.MAX_BUCKET_EDGES = exports.DEFAULT_BUCKETS = void 0;
exports.parseBuckets = parseBuckets;
exports.bucketLabels = bucketLabels;
exports.bucketCount = bucketCount;
exports.bucketIndex = bucketIndex;
exports.bucketIndexSql = bucketIndexSql;
exports.aboveDaysEdge = aboveDaysEdge;
exports.dueEff = dueEff;
exports.overdueDays = overdueDays;
exports.ageOf = ageOf;
exports.addDays = addDays;
exports.daysBetween = daysBetween;
exports.isRealIsoDate = isRealIsoDate;
exports.istToday = istToday;
exports.collectionDayNumber = collectionDayNumber;
exports.collectionDayNames = collectionDayNames;
const client_1 = require("@prisma/client");
exports.DEFAULT_BUCKETS = [30, 60, 90, 180];
exports.MAX_BUCKET_EDGES = 6;
exports.MAX_BUCKET_DAYS = 3650;
exports.NOT_DUE_LABEL = 'Not due';
function parseBuckets(raw) {
    if (raw === undefined || raw === null || raw.trim() === '') {
        return [...exports.DEFAULT_BUCKETS];
    }
    const parts = raw.split(/[\s,]+/).filter((p) => p !== '');
    if (parts.length < 1 || parts.length > exports.MAX_BUCKET_EDGES) {
        return null;
    }
    const edges = [];
    for (const part of parts) {
        if (!/^\d+$/.test(part)) {
            return null;
        }
        const n = Number(part);
        if (n < 1 || n > exports.MAX_BUCKET_DAYS) {
            return null;
        }
        if (edges.length > 0 && n <= edges[edges.length - 1]) {
            return null;
        }
        edges.push(n);
    }
    return edges;
}
function bucketLabels(edges, ageBy) {
    const labels = ageBy === 'DUE_DATE' ? [exports.NOT_DUE_LABEL] : [];
    let low = 0;
    for (const edge of edges) {
        labels.push(`${low}–${edge}`);
        low = edge + 1;
    }
    labels.push(`> ${edges[edges.length - 1]}`);
    return labels;
}
function bucketCount(edges, ageBy) {
    return edges.length + 1 + (ageBy === 'DUE_DATE' ? 1 : 0);
}
function bucketIndex(age, edges, ageBy) {
    const shift = ageBy === 'DUE_DATE' ? 1 : 0;
    if (ageBy === 'DUE_DATE' && age < 0) {
        return 0;
    }
    for (let i = 0; i < edges.length; i += 1) {
        if (age <= edges[i]) {
            return i + shift;
        }
    }
    return edges.length + shift;
}
function bucketIndexSql(ageExpr, edges, ageBy) {
    const shift = ageBy === 'DUE_DATE' ? 1 : 0;
    const arms = [];
    if (ageBy === 'DUE_DATE') {
        arms.push(client_1.Prisma.sql `WHEN ${ageExpr} < 0 THEN 0`);
    }
    edges.forEach((edge, i) => {
        arms.push(client_1.Prisma.sql `WHEN ${ageExpr} <= ${edge}::int THEN ${i + shift}::int`);
    });
    return client_1.Prisma.sql `(CASE ${client_1.Prisma.join(arms, ' ')} ELSE ${edges.length + shift}::int END)`;
}
function aboveDaysEdge(edges) {
    return edges[2] ?? edges[edges.length - 1];
}
function dueEff(docDate, dueDate, creditDays) {
    return dueDate ?? addDays(docDate, creditDays ?? 0);
}
function overdueDays(asOn, due, graceDays) {
    const days = daysBetween(due, asOn) - (graceDays ?? 0);
    return days > 0 ? days : null;
}
function ageOf(asOn, docDate, due, ageBy) {
    return ageBy === 'DUE_DATE' ? daysBetween(due, asOn) : daysBetween(docDate, asOn);
}
const DAY_MS = 86_400_000;
function addDays(iso, days) {
    return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
function daysBetween(from, to) {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
function isRealIsoDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return false;
    }
    const t = Date.parse(`${iso}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
}
function istToday(now = new Date()) {
    return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
exports.COLLECTION_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
function collectionDayNumber(day) {
    return exports.COLLECTION_DAYS.indexOf(day) + 1;
}
function collectionDayNames(days) {
    return [...new Set(days ?? [])]
        .filter((d) => d >= 1 && d <= 7)
        .sort((a, b) => a - b)
        .map((d) => exports.COLLECTION_DAYS[d - 1]);
}
//# sourceMappingURL=party-outstanding.ageing.js.map