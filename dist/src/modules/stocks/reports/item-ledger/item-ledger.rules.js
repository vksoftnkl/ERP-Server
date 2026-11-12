"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTER_CASH = exports.PURCHASE_DOC_TYPES = exports.SALES_DOC_TYPES = exports.SHADOW_DOC_TYPES = exports.REPORT_TYPE_CODES = exports.REPORT_TYPES = exports.BUCKET_LABEL = exports.ORDERS = exports.VALUE_AT = exports.BUCKET_CHOICES = exports.STOCK_BUCKETS = void 0;
exports.bucketLabel = bucketLabel;
exports.reportTypeOrder = reportTypeOrder;
exports.reportTypeOf = reportTypeOf;
exports.rowTypeLabel = rowTypeLabel;
exports.tileLabel = tileLabel;
exports.byTypeLabel = byTypeLabel;
exports.docKindOf = docKindOf;
exports.partyOf = partyOf;
exports.sameId = sameId;
exports.revisionOf = revisionOf;
exports.dmy = dmy;
exports.dayBefore = dayBefore;
exports.monthLabel = monthLabel;
exports.monthsBetween = monthsBetween;
exports.monthEnd = monthEnd;
exports.isRealIsoDate = isRealIsoDate;
exports.transitText = transitText;
exports.qtyIn = qtyIn;
exports.rateIn = rateIn;
exports.rateOf = rateOf;
exports.money = money;
exports.dec = dec;
exports.printedAsOf = printedAsOf;
const client_1 = require("@prisma/client");
exports.STOCK_BUCKETS = ['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE'];
exports.BUCKET_CHOICES = [...exports.STOCK_BUCKETS, 'ALL'];
exports.VALUE_AT = ['WITHOUT_TAX', 'WITH_TAX'];
exports.ORDERS = ['asc', 'desc'];
exports.BUCKET_LABEL = {
    SALEABLE: 'Saleable',
    DAMAGED: 'Damaged',
    QUARANTINE: 'Quarantine',
    EXPIRED: 'Expired',
    SAMPLE: 'Sample',
};
function bucketLabel(bucket) {
    return bucket ? (exports.BUCKET_LABEL[bucket] ?? bucket) : '';
}
exports.REPORT_TYPES = {
    OPENING: { label: 'Opening stock', kind: 'IN', tile: 'opening' },
    GRN: { label: 'GRN', kind: 'IN', tile: 'GRNs' },
    PURCHASE: { label: 'Purchase', kind: 'IN', tile: 'purchases' },
    SHORTAGE_RECEIPT: { label: 'Shortage receipt', kind: 'IN', tile: 'shortage receipts' },
    PURCHASE_RETURN: { label: 'Purchase return', kind: 'OUT', tile: 'purchase returns' },
    SALE: { label: 'Sale', kind: 'OUT', tile: 'sales' },
    SALE_RETURN: { label: 'Sale return', kind: 'IN', tile: 'sale returns' },
    DC: { label: 'Delivery challan', kind: 'OUT', tile: 'challans' },
    DC_RETURN: { label: 'Challan return', kind: 'IN', tile: 'challan returns' },
    GODOWN_TRANSFER: { label: 'Godown transfer', kind: 'INTERNAL', tile: 'godown transfers' },
    BRANCH_OUT: { label: 'Branch outward', kind: 'OUT', tile: 'branch out' },
    BRANCH_IN: { label: 'Branch inward', kind: 'IN', tile: 'branch in' },
    ADJUST_PLUS: { label: 'Adjustment +', kind: 'IN', tile: 'adjustments +' },
    ADJUST_MINUS: { label: 'Adjustment −', kind: 'OUT', tile: 'adjustments −' },
    COUNT_EXCESS: { label: 'Count excess', kind: 'IN', tile: 'count excess' },
    COUNT_SHORT: { label: 'Count shortage', kind: 'OUT', tile: 'count shortage' },
    DAMAGE: { label: 'Damage', kind: 'OUT', tile: 'damage' },
    EXPIRED: { label: 'Expired', kind: 'OUT', tile: 'expired' },
    SAMPLE: { label: 'Sample', kind: 'OUT', tile: 'samples' },
    GIFT: { label: 'Gift', kind: 'OUT', tile: 'gifts' },
    BUCKET_MOVE: { label: 'Bucket move', kind: 'INTERNAL', tile: 'bucket moves' },
    REPACK: { label: 'Repack', kind: 'MIXED', tile: 'repacks' },
    REVALUED: { label: 'Revalued', kind: 'VALUE', tile: 'revaluations' },
};
exports.REPORT_TYPE_CODES = Object.keys(exports.REPORT_TYPES);
function reportTypeOrder(type) {
    const i = exports.REPORT_TYPE_CODES.indexOf(type);
    return i < 0 ? exports.REPORT_TYPE_CODES.length : i;
}
function reportTypeOf(txnType, srcDocType, opts = {}) {
    if (opts.internal) {
        return txnType.startsWith('TRANSFER') ? 'GODOWN_TRANSFER' : 'BUCKET_MOVE';
    }
    switch (txnType) {
        case 'OPENING':
            return 'OPENING';
        case 'PURCHASE':
            return srcDocType === 'GRN'
                ? 'GRN'
                : srcDocType === 'SHORTAGE_RECEIPT'
                    ? 'SHORTAGE_RECEIPT'
                    : 'PURCHASE';
        case 'PURCHASE_RETURN':
        case 'SALE':
        case 'SALE_RETURN':
        case 'DC_RETURN':
        case 'ADJUST_PLUS':
        case 'ADJUST_MINUS':
        case 'DAMAGE':
            return txnType;
        case 'DC_ISSUE':
            return 'DC';
        case 'PHYSICAL_PLUS':
            return 'COUNT_EXCESS';
        case 'PHYSICAL_MINUS':
            return 'COUNT_SHORT';
        case 'EXPIRY_WRITEOFF':
            return 'EXPIRED';
        case 'SAMPLE_ISSUE':
            return 'SAMPLE';
        case 'GIFT_ISSUE':
            return 'GIFT';
        case 'BUCKET_OUT':
        case 'BUCKET_IN':
            return 'BUCKET_MOVE';
        case 'REPACK_IN':
        case 'REPACK_OUT':
            return 'REPACK';
        case 'TRANSFER_IN':
            return srcDocType === 'TRANSFER_IN' ? 'BRANCH_IN' : 'GODOWN_TRANSFER';
        case 'TRANSFER_OUT':
            return opts.toOtherBranch ? 'BRANCH_OUT' : 'GODOWN_TRANSFER';
        default:
            return txnType;
    }
}
function rowTypeLabel(type, kind, otherBucket = null) {
    if (type === 'GODOWN_TRANSFER') {
        return kind === 'OUT'
            ? 'Godown transfer out'
            : kind === 'IN'
                ? 'Godown transfer in'
                : 'Godown transfer';
    }
    if (type === 'BUCKET_MOVE') {
        if (kind === 'OUT' && otherBucket)
            return `To ${bucketLabel(otherBucket)}`;
        if (kind === 'IN' && otherBucket)
            return `From ${bucketLabel(otherBucket)}`;
        return kind === 'OUT' ? 'Bucket move out' : kind === 'IN' ? 'Bucket move in' : 'Bucket move';
    }
    if (type === 'REPACK') {
        return kind === 'OUT' ? 'Repack out' : 'Repack in';
    }
    return exports.REPORT_TYPES[type]?.label ?? type;
}
function tileLabel(type, kind, otherBucket) {
    if (type === 'BUCKET_MOVE' && otherBucket) {
        return `${kind === 'OUT' ? 'to' : 'from'} ${bucketLabel(otherBucket).toLowerCase()}`;
    }
    if (type === 'GODOWN_TRANSFER' && kind !== 'INTERNAL') {
        return kind === 'OUT' ? 'godown transfers out' : 'godown transfers in';
    }
    return exports.REPORT_TYPES[type]?.tile ?? type.toLowerCase();
}
function byTypeLabel(type, pairClass) {
    const base = exports.REPORT_TYPES[type]?.label ?? type;
    if (pairClass === 'CANCELLED')
        return `${base} cancelled (pair)`;
    if (pairClass === 'AMENDED')
        return `${base} amended (pair, old lines)`;
    return base;
}
exports.SHADOW_DOC_TYPES = [
    'SALE_BILL',
    'DELIVERY_CHALLAN',
    'SALE_RETURN',
    'DC_RETURN',
    'GRN',
    'PURCHASE_BILL',
    'SHORTAGE_RECEIPT',
    'PURCHASE_RETURN',
];
exports.SALES_DOC_TYPES = ['SALE_BILL', 'DELIVERY_CHALLAN', 'SALE_RETURN', 'DC_RETURN'];
exports.PURCHASE_DOC_TYPES = ['GRN', 'PURCHASE_BILL', 'SHORTAGE_RECEIPT', 'PURCHASE_RETURN'];
function docKindOf(input) {
    const link = input.linkDocType;
    if (link && exports.SHADOW_DOC_TYPES.includes(link)) {
        return link;
    }
    const vt = input.voucherType ?? input.srcDocType;
    switch (vt) {
        case 'OPENING':
        case 'PHYSICAL':
        case 'ADJUSTMENT':
        case 'ISSUE':
            return vt;
        case 'TRANSFER_OUT':
            return input.toBranchId ? 'BRANCH_OUTWARD' : 'GODOWN_TRANSFER';
        case 'TRANSFER_IN':
            return 'BRANCH_INWARD';
        default:
            return exports.SHADOW_DOC_TYPES.includes(vt ?? '') ? vt : null;
    }
}
exports.COUNTER_CASH = 'Counter (cash)';
function partyOf(input) {
    const kind = input.docKind ?? '';
    const name = clean(input.ledgerName);
    if (kind === 'SALE_BILL') {
        const customerId = input.billCustomerId ?? input.partyId;
        const isWalkInLedger = sameId(customerId, input.walkInId);
        const walkIn = customerId === null || isWalkInLedger;
        const typed = clean(input.billCustomerName);
        if (walkIn) {
            const own = clean(input.walkInName) ?? (isWalkInLedger ? name : null);
            const label = typed && (!own || typed.toLowerCase() !== own.toLowerCase()) ? typed : exports.COUNTER_CASH;
            return { id: customerId, label, walkIn: true };
        }
        return { id: customerId, label: typed ?? name ?? '', walkIn: false };
    }
    if (exports.SALES_DOC_TYPES.includes(kind) || input.srcModule === 'SALES') {
        const walkIn = input.partyId === null || sameId(input.partyId, input.walkInId);
        return walkIn
            ? { id: input.partyId, label: exports.COUNTER_CASH, walkIn: true }
            : { id: input.partyId, label: name ?? '', walkIn: false };
    }
    if (exports.PURCHASE_DOC_TYPES.includes(kind) || input.srcModule === 'PURCHASE') {
        return input.partyId || name ? { id: input.partyId, label: name ?? '', walkIn: false } : null;
    }
    return null;
}
function clean(value) {
    const t = value?.trim();
    return t ? t : null;
}
function sameId(a, b) {
    return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}
function revisionOf(voucherRefno) {
    const m = /\/r(\d+)$/.exec(voucherRefno ?? '');
    if (!m)
        return null;
    const n = Number(m[1]);
    return n > 1 ? n : null;
}
function dmy(iso) {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}
function dayBefore(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
function monthLabel(month) {
    const names = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    return `${names[Number(month.slice(5, 7)) - 1]}-${month.slice(0, 4)}`;
}
function monthsBetween(from, to) {
    const out = [];
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const endY = Number(to.slice(0, 4));
    const endM = Number(to.slice(5, 7));
    while (y < endY || (y === endY && m <= endM)) {
        out.push(`${y}-${String(m).padStart(2, '0')}`);
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
    }
    return out;
}
function monthEnd(month) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function isRealIsoDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function transitText(status, receivedOn) {
    switch (status) {
        case 'RECEIVED':
            return receivedOn ? `received ${dmy(receivedOn)}` : 'received';
        case 'PARTIAL':
            return 'part received';
        case 'IN_TRANSIT':
            return 'in transit';
        case 'CANCELLED':
            return 'recalled';
        default:
            return null;
    }
}
function qtyIn(base, factor) {
    return new client_1.Prisma.Decimal(base).dividedBy(factor).toFixed(3);
}
function rateIn(baseRate, factor) {
    return new client_1.Prisma.Decimal(baseRate).times(factor).toFixed(2);
}
function rateOf(value, baseQty, factor) {
    const q = new client_1.Prisma.Decimal(baseQty);
    if (q.isZero())
        return null;
    return new client_1.Prisma.Decimal(value).dividedBy(q).times(factor).abs().toFixed(2);
}
function money(value) {
    return new client_1.Prisma.Decimal(value).toFixed(2);
}
function dec(value) {
    return new client_1.Prisma.Decimal(value ?? 0);
}
function printedAsOf(parts) {
    return [
        parts.itemName,
        parts.branchName,
        `${dmy(parts.from)} to ${dmy(parts.to)}`,
        parts.godownName ?? 'All godowns',
        parts.bucket === 'ALL' ? 'All buckets' : bucketLabel(parts.bucket),
        parts.batchNo ? `Batch ${parts.batchNo}` : 'All batches',
        parts.types.length
            ? `Types: ${parts.types.map((t) => exports.REPORT_TYPES[t]?.label ?? t).join(', ')}`
            : 'All types',
        `Qty in ${parts.unitName}`,
        parts.valueAt === 'WITH_TAX' ? 'Cost with tax' : 'Cost without tax',
        parts.showReversed ? 'Cancelled & amended shown' : 'Cancelled & amended hidden',
    ]
        .filter(Boolean)
        .join(' · ');
}
//# sourceMappingURL=item-ledger.rules.js.map