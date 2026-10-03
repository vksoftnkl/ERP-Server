"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDraft = emptyDraft;
exports.buildDraftLines = buildDraftLines;
exports.rehydrateDraft = rehydrateDraft;
const receipt_enum_1 = require("./types/receipt-enum");
function emptyDraft() {
    return { otherLines: [], cheques: {}, allocations: [], creditsApplied: [] };
}
function buildDraftLines(otherLines, cheques, allocations, creditsApplied) {
    return {
        otherLines: otherLines,
        cheques: Object.fromEntries(Object.entries(cheques).filter(([, detail]) => detail !== null)),
        allocations: allocations,
        creditsApplied: creditsApplied,
    };
}
function rehydrateDraft(value) {
    if (value === null || value === undefined) {
        return emptyDraft();
    }
    if (Array.isArray(value)) {
        return { ...emptyDraft(), otherLines: readOtherLines(value) };
    }
    if (typeof value !== 'object') {
        return emptyDraft();
    }
    const record = value;
    return {
        otherLines: Array.isArray(record.otherLines) ? readOtherLines(record.otherLines) : [],
        cheques: readCheques(record.cheques),
        allocations: Array.isArray(record.allocations) ? readAllocations(record.allocations) : [],
        creditsApplied: Array.isArray(record.creditsApplied) ? readCredits(record.creditsApplied) : [],
    };
}
function readAllocations(value) {
    const rows = [];
    for (const entry of value) {
        const row = asRecord(entry);
        if (!row || typeof row.billId !== 'string' || typeof row.billAccYear !== 'string') {
            continue;
        }
        rows.push({
            billId: row.billId,
            billAccYear: row.billAccYear,
            amount: num(row.amount),
            discount: num(row.discount),
            writeoff: num(row.writeoff),
            roundoff: num(row.roundoff),
            writeoffApprovedBy: str(row.writeoffApprovedBy),
        });
    }
    return rows;
}
function readCredits(value) {
    const rows = [];
    for (const entry of value) {
        const row = asRecord(entry);
        if (!row || typeof row.billId !== 'string' || typeof row.billAccYear !== 'string') {
            continue;
        }
        rows.push({
            billId: row.billId,
            billAccYear: row.billAccYear,
            amount: num(row.amount),
        });
    }
    return rows;
}
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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