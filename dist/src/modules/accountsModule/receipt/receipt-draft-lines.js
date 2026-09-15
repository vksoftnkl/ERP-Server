"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDraft = emptyDraft;
exports.buildDraftLines = buildDraftLines;
exports.rehydrateDraft = rehydrateDraft;
const receipt_enum_1 = require("./types/receipt-enum");
function emptyDraft() {
    return { otherLines: [], cheques: {} };
}
function buildDraftLines(otherLines, cheques) {
    return {
        otherLines: otherLines,
        cheques: Object.fromEntries(Object.entries(cheques).filter(([, detail]) => detail !== null)),
    };
}
function rehydrateDraft(value) {
    if (value === null || value === undefined) {
        return emptyDraft();
    }
    if (Array.isArray(value)) {
        return { otherLines: readOtherLines(value), cheques: {} };
    }
    if (typeof value !== 'object') {
        return emptyDraft();
    }
    const record = value;
    return {
        otherLines: Array.isArray(record.otherLines) ? readOtherLines(record.otherLines) : [],
        cheques: readCheques(record.cheques),
    };
}
function readOtherLines(value) {
    const lines = [];
    value.forEach((entry, index) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            return;
        }
        const row = entry;
        if (typeof row.ledgerId !== 'string' || typeof row.amount !== 'number') {
            return;
        }
        lines.push({
            lineNo: typeof row.lineNo === 'number' ? row.lineNo : index + 1,
            role: typeof row.role === 'string' ? row.role : null,
            ledgerId: row.ledgerId,
            ledgerName: typeof row.ledgerName === 'string' ? row.ledgerName : null,
            drCr: row.drCr === receipt_enum_1.DrCr.CR ? receipt_enum_1.DrCr.CR : receipt_enum_1.DrCr.DR,
            amount: row.amount,
            settlesBill: row.settlesBill === true,
            narration: typeof row.narration === 'string' ? row.narration : null,
        });
    });
    return lines;
}
function readCheques(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {};
    }
    const cheques = {};
    for (const [key, entry] of Object.entries(value)) {
        const rowNo = Number(key);
        if (!Number.isInteger(rowNo) || typeof entry !== 'object' || entry === null) {
            continue;
        }
        const row = entry;
        cheques[rowNo] = {
            bankBranch: str(row.bankBranch),
            ifsc: str(row.ifsc),
            micr: str(row.micr),
            drawerName: str(row.drawerName),
            bankLedgerId: str(row.bankLedgerId),
        };
    }
    return cheques;
}
function str(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
//# sourceMappingURL=receipt-draft-lines.js.map