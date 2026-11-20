"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEM_HISTORY_CHILD_SCREENS = void 0;
exports.itemChildDisplayName = itemChildDisplayName;
exports.ITEM_HISTORY_CHILD_SCREENS = new Set([
    'Item Unit Conversion Master',
    'Item Price Master',
    'Item EAN Code Master',
    'Item Reorder Master',
]);
const text = (value) => {
    if (value === null || value === undefined || typeof value === 'object') {
        return null;
    }
    const shown = String(value).trim();
    return shown ? shown : null;
};
const joined = (...parts) => parts.filter((part) => part !== null).join(' · ');
function itemChildDisplayName(screenName, record) {
    if (!exports.ITEM_HISTORY_CHILD_SCREENS.has(screenName)) {
        return null;
    }
    const row = record !== null && typeof record === 'object' && !Array.isArray(record) ? record : {};
    const unit = text(row['Unit ID']);
    const branch = text(row['Branch ID']);
    const godown = text(row['Godown ID']);
    switch (screenName) {
        case 'Item Unit Conversion Master':
            return `Unit ${unit ?? '?'}${row['Is Base Unit'] === true ? ' (base)' : ''}`;
        case 'Item Price Master': {
            const mrp = text(row['MRP Bucket']);
            return joined(`Price ${unit ?? '?'}`, branch, godown, mrp ? `MRP ${mrp}` : null);
        }
        case 'Item EAN Code Master': {
            const code = text(row['EAN / Barcode']) ?? '?';
            return `Barcode ${code}${unit ? ` (${unit})` : ''}`;
        }
        default:
            return joined(`Reorder ${unit ?? 'any unit'}`, branch, godown);
    }
}
//# sourceMappingURL=audit-item-history.js.map