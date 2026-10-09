"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStatementFormat = validateStatementFormat;
exports.parseStatementCsv = parseStatementCsv;
exports.parseAmount = parseAmount;
exports.parseDateTime = parseDateTime;
exports.istDate = istDate;
exports.groupByPayout = groupByPayout;
const client_1 = require("@prisma/client");
const csv_helper_1 = require("../../stocks/stock-voucher/csv.helper");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
const COLUMN_KEYS = [
    'gross',
    'txnOn',
    'kind',
    'terminalId',
    'vpa',
    'refNo',
    'authCode',
    'cardLast4',
    'payer',
    'fee',
    'tax',
    'net',
    'payoutRef',
    'payoutDate',
];
const IST_OFFSET_MINUTES = 330;
function validateStatementFormat(raw) {
    const problems = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { format: null, problems: ['The statement format must be an object'] };
    }
    const f = raw;
    if (f.version !== 1) {
        problems.push('version must be 1');
    }
    const source = typeof f.source === 'string' ? f.source.toUpperCase() : '';
    if (!Object.values(tender_settlement_enum_1.SettlementSource).includes(source)) {
        problems.push(`source must be one of ${Object.values(tender_settlement_enum_1.SettlementSource).join(', ')}`);
    }
    const provider = typeof f.provider === 'string' ? f.provider.trim() : '';
    if (!provider || provider.length > 60) {
        problems.push('provider is required (60 characters at most)');
    }
    const columns = {};
    if (!f.columns || typeof f.columns !== 'object' || Array.isArray(f.columns)) {
        problems.push('columns is required: { gross: "<header>", … }');
    }
    else {
        for (const [key, value] of Object.entries(f.columns)) {
            if (!COLUMN_KEYS.includes(key)) {
                problems.push(`columns.${key} is not a field the import reads (${COLUMN_KEYS.join(', ')})`);
                continue;
            }
            if (typeof value !== 'string' || !value.trim()) {
                problems.push(`columns.${key} must name a header`);
                continue;
            }
            columns[key] = value.trim();
        }
        if (!columns.gross) {
            problems.push('columns.gross is required');
        }
    }
    let kindMap;
    if (f.kindMap !== undefined && f.kindMap !== null) {
        if (typeof f.kindMap !== 'object' || Array.isArray(f.kindMap)) {
            problems.push('kindMap must be an object of kind → words');
        }
        else {
            kindMap = {};
            for (const [kind, words] of Object.entries(f.kindMap)) {
                if (!Object.values(tender_settlement_enum_1.SettlementLineKind).includes(kind)) {
                    problems.push(`kindMap.${kind} is not a line kind`);
                    continue;
                }
                if (!Array.isArray(words) || words.some((w) => typeof w !== 'string' || !w.trim())) {
                    problems.push(`kindMap.${kind} must be a list of words`);
                    continue;
                }
                kindMap[kind] = words.map((w) => w.trim());
            }
        }
    }
    if (columns.kind && !kindMap) {
        problems.push('A kind column needs a kindMap saying which words mean SALE, REFUND …');
    }
    const dateFormat = typeof f.dateFormat === 'string' ? f.dateFormat.trim() : undefined;
    if (dateFormat && !(/D/.test(dateFormat) && /M/.test(dateFormat) && /YY/.test(dateFormat))) {
        problems.push('dateFormat must contain DD, MM and YYYY (or YY)');
    }
    if (f.negativeIsRefund !== undefined && typeof f.negativeIsRefund !== 'boolean') {
        problems.push('negativeIsRefund must be true or false');
    }
    if (problems.length > 0) {
        return { format: null, problems };
    }
    return {
        format: {
            version: 1,
            source: source,
            provider,
            columns: columns,
            ...(kindMap ? { kindMap } : {}),
            ...(dateFormat ? { dateFormat } : {}),
            negativeIsRefund: f.negativeIsRefund ?? true,
        },
        problems,
    };
}
function parseStatementCsv(text, format) {
    const table = (0, csv_helper_1.readCsvTable)(text);
    const problems = [];
    const col = (key) => format.columns[key] ? format.columns[key].trim().toLowerCase() : null;
    for (const key of COLUMN_KEYS) {
        const header = col(key);
        if (header && !table.headers.includes(header)) {
            problems.push({
                lineNo: 1,
                message: `The file has no "${format.columns[key]}" column (columns.${key}); its headers are: ${table.headers.join(', ')}`,
            });
        }
    }
    if (problems.length > 0) {
        return { lines: [], problems };
    }
    const lines = [];
    const cell = (cells, key) => {
        const header = col(key);
        if (!header)
            return null;
        const value = (cells[header] ?? '').trim();
        return value === '' ? null : value;
    };
    for (const row of table.rows) {
        const bad = (message) => problems.push({ lineNo: row.lineNo, message });
        const grossRaw = parseAmount(cell(row.cells, 'gross'));
        if (grossRaw === null) {
            bad(`gross "${cell(row.cells, 'gross') ?? ''}" is not an amount`);
            continue;
        }
        let kind = null;
        const kindCell = cell(row.cells, 'kind');
        if (col('kind')) {
            kind = kindOf(kindCell, format.kindMap ?? {});
            if (!kind) {
                bad(`kind "${kindCell ?? ''}" is in no kindMap list`);
                continue;
            }
        }
        else {
            kind =
                grossRaw.isNegative() && format.negativeIsRefund !== false
                    ? tender_settlement_enum_1.SettlementLineKind.REFUND
                    : tender_settlement_enum_1.SettlementLineKind.SALE;
        }
        const fee = parseAmount(cell(row.cells, 'fee')) ?? new client_1.Prisma.Decimal(0);
        const tax = parseAmount(cell(row.cells, 'tax')) ?? new client_1.Prisma.Decimal(0);
        if (col('fee') && cell(row.cells, 'fee') && parseAmount(cell(row.cells, 'fee')) === null) {
            bad(`fee "${cell(row.cells, 'fee')}" is not an amount`);
            continue;
        }
        if (col('tax') && cell(row.cells, 'tax') && parseAmount(cell(row.cells, 'tax')) === null) {
            bad(`tax "${cell(row.cells, 'tax')}" is not an amount`);
            continue;
        }
        const gross = grossRaw.abs();
        const feeAbs = fee.abs();
        const taxAbs = tax.abs();
        const net = gross.minus(feeAbs).minus(taxAbs);
        const netCell = cell(row.cells, 'net');
        if (netCell !== null) {
            const stated = parseAmount(netCell);
            if (stated === null || !stated.abs().minus(net.abs()).abs().lessThan('0.005')) {
                bad(`net ${netCell} ≠ gross ${gross.toFixed(2)} − fee ${feeAbs.toFixed(2)} − tax ${taxAbs.toFixed(2)}`);
                continue;
            }
        }
        const txnCell = cell(row.cells, 'txnOn');
        const txnOn = txnCell ? parseDateTime(txnCell, format.dateFormat) : null;
        if (txnCell && !txnOn) {
            bad(`txnOn "${txnCell}" does not read as ${format.dateFormat ?? 'YYYY-MM-DD HH:mm'}`);
            continue;
        }
        const payoutCell = cell(row.cells, 'payoutDate');
        const payoutOn = payoutCell ? parseDateTime(payoutCell, format.dateFormat) : null;
        if (payoutCell && !payoutOn) {
            bad(`payoutDate "${payoutCell}" does not read as ${format.dateFormat ?? 'YYYY-MM-DD'}`);
            continue;
        }
        const last4Cell = cell(row.cells, 'cardLast4');
        const last4 = last4Cell ? last4Cell.replace(/\D/g, '').slice(-4) || null : null;
        if (last4Cell && (!last4 || last4.length !== 4)) {
            bad(`cardLast4 "${last4Cell}" has no four digits at its end`);
            continue;
        }
        lines.push({
            lineNo: row.lineNo,
            kind,
            txnOn,
            terminalId: trimTo(cell(row.cells, 'terminalId'), 40),
            vpa: trimTo(cell(row.cells, 'vpa'), 100),
            refNo: trimTo(cell(row.cells, 'refNo'), 60),
            authCode: trimTo(cell(row.cells, 'authCode'), 20),
            cardLast4: last4,
            payer: trimTo(cell(row.cells, 'payer'), 150),
            gross: round2(gross),
            fee: round2(feeAbs),
            tax: round2(taxAbs),
            net: round2(gross).minus(round2(feeAbs)).minus(round2(taxAbs)),
            payoutRef: trimTo(cell(row.cells, 'payoutRef'), 60),
            payoutDate: payoutOn ? istDate(payoutOn) : null,
            raw: row.cells,
        });
    }
    return { lines, problems };
}
function parseAmount(value) {
    if (value === null) {
        return null;
    }
    let token = value.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
    let negative = false;
    if (/^\(.*\)$/.test(token)) {
        negative = true;
        token = token.slice(1, -1);
    }
    const side = /(cr|dr)$/i.exec(token);
    if (side) {
        negative = negative || side[1].toLowerCase() === 'dr';
        token = token.slice(0, -2);
    }
    if (!/^[-+]?\d+(\.\d+)?$/.test(token)) {
        return null;
    }
    const parsed = new client_1.Prisma.Decimal(token);
    return negative ? parsed.negated() : parsed;
}
function parseDateTime(value, format) {
    const text = value.trim();
    let parts;
    if (!format) {
        const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
        parts = iso
            ? {
                y: +iso[1],
                m: +iso[2],
                d: +iso[3],
                hh: +(iso[4] ?? 0),
                mi: +(iso[5] ?? 0),
                ss: +(iso[6] ?? 0),
            }
            : null;
    }
    else {
        const datePart = format.split(/\s+/)[0];
        parts =
            readWithPattern(text, format) ??
                (datePart !== format ? readWithPattern(text, datePart) : null);
    }
    if (!parts) {
        return null;
    }
    const { y, m, d, hh, mi, ss } = parts;
    if (![y, m, d, hh, mi, ss].every(Number.isFinite) || m < 1 || m > 12 || d < 1 || d > 31) {
        return null;
    }
    if (hh > 23 || mi > 59 || ss > 59) {
        return null;
    }
    const date = new Date(Date.UTC(y, m - 1, d, hh, mi, ss) - IST_OFFSET_MINUTES * 60_000);
    return istDate(date) === `${y}-${pad(m)}-${pad(d)}` ? date : null;
}
function readWithPattern(text, format) {
    const order = [];
    const pattern = format.replace(/YYYY|YY|MM|M|DD|D|HH|mm|ss|[^A-Za-z]+/g, (token) => {
        if (/^[^A-Za-z]+$/.test(token)) {
            return '[^0-9]+';
        }
        order.push(token);
        return token === 'YYYY' ? '(\\d{4})' : token.length === 1 ? '(\\d{1,2})' : '(\\d{2})';
    });
    const match = new RegExp(`^${pattern}$`).exec(text);
    if (!match) {
        return null;
    }
    const got = {};
    order.forEach((token, i) => {
        got[token] = Number(match[i + 1]);
    });
    return {
        y: got.YYYY ?? (got.YY !== undefined ? 2000 + got.YY : NaN),
        m: got.MM ?? got.M,
        d: got.DD ?? got.D,
        hh: got.HH ?? 0,
        mi: got.mm ?? 0,
        ss: got.ss ?? 0,
    };
}
function istDate(d) {
    return new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}
function groupByPayout(lines, fallback) {
    const groups = new Map();
    for (const line of lines) {
        const payoutRef = line.payoutRef ?? fallback.payoutRef;
        const payoutDate = line.payoutDate ?? fallback.payoutDate;
        const key = `${payoutRef ?? ''}|${payoutRef ? '' : (payoutDate ?? '')}`;
        const group = groups.get(key) ?? { payoutRef, payoutDate, lines: [] };
        if (payoutDate && (!group.payoutDate || payoutDate > group.payoutDate)) {
            group.payoutDate = payoutDate;
        }
        group.lines.push(line);
        groups.set(key, group);
    }
    return [...groups.values()];
}
function kindOf(value, kindMap) {
    if (!value) {
        return null;
    }
    const token = value.trim().toLowerCase();
    for (const [kind, words] of Object.entries(kindMap)) {
        if ((words ?? []).some((w) => w.toLowerCase() === token)) {
            return kind;
        }
    }
    return null;
}
function trimTo(value, max) {
    return value === null ? null : value.slice(0, max);
}
function round2(value) {
    return value.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function pad(n) {
    return String(n).padStart(2, '0');
}
//# sourceMappingURL=settlement-format.js.map