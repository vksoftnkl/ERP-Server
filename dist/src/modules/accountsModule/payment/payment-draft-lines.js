"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyPaymentDraft = emptyPaymentDraft;
exports.buildPaymentDraftLines = buildPaymentDraftLines;
exports.rehydratePaymentDraft = rehydratePaymentDraft;
const payment_enum_1 = require("./types/payment-enum");
function emptyPaymentDraft() {
    return { otherLines: [], cheques: {}, beneficiaries: {}, allocations: [], creditsApplied: [] };
}
function buildPaymentDraftLines(otherLines, cheques, beneficiaries, allocations, creditsApplied) {
    return {
        otherLines: otherLines,
        cheques: Object.fromEntries(Object.entries(cheques).filter(([, detail]) => detail !== null)),
        beneficiaries: Object.fromEntries(Object.entries(beneficiaries).filter(([, detail]) => detail !== null)),
        allocations: allocations,
        creditsApplied: creditsApplied,
    };
}
function rehydratePaymentDraft(value) {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
        return emptyPaymentDraft();
    }
    const record = value;
    return {
        otherLines: Array.isArray(record.otherLines) ? readOtherLines(record.otherLines) : [],
        cheques: readCheques(record.cheques),
        beneficiaries: readBeneficiaries(record.beneficiaries),
        allocations: Array.isArray(record.allocations) ? readAllocations(record.allocations) : [],
        creditsApplied: Array.isArray(record.creditsApplied) ? readCredits(record.creditsApplied) : [],
    };
}
function readOtherLines(value) {
    const lines = [];
    value.forEach((entry, index) => {
        const row = asRecord(entry);
        if (!row || typeof row.ledgerId !== 'string' || typeof row.amount !== 'number') {
            return;
        }
        lines.push({
            lineNo: typeof row.lineNo === 'number' ? row.lineNo : index + 1,
            role: typeof row.role === 'string' ? row.role : null,
            ledgerId: row.ledgerId,
            ledgerName: typeof row.ledgerName === 'string' ? row.ledgerName : null,
            drCr: row.drCr === payment_enum_1.DrCr.DR ? payment_enum_1.DrCr.DR : payment_enum_1.DrCr.CR,
            amount: row.amount,
            settlesBill: row.settlesBill === true,
            narration: str(row.narration),
            approvedBy: str(row.approvedBy),
        });
    });
    return lines;
}
function readCheques(value) {
    const out = {};
    const record = asRecord(value);
    if (!record) {
        return out;
    }
    for (const [key, entry] of Object.entries(record)) {
        const rowNo = Number(key);
        const row = asRecord(entry);
        if (!Number.isInteger(rowNo) || !row || typeof row.chequeBookId !== 'string') {
            continue;
        }
        out[rowNo] = {
            chequeBookId: row.chequeBookId,
            favouring: str(row.favouring),
            acPayee: row.acPayee !== false,
            bankBranch: str(row.bankBranch),
            ifsc: str(row.ifsc),
            micr: str(row.micr),
            drawerName: str(row.drawerName),
        };
    }
    return out;
}
function readBeneficiaries(value) {
    const out = {};
    const record = asRecord(value);
    if (!record) {
        return out;
    }
    for (const [key, entry] of Object.entries(record)) {
        const rowNo = Number(key);
        const row = asRecord(entry);
        if (!Number.isInteger(rowNo) || !row) {
            continue;
        }
        out[rowNo] = { name: str(row.name), accountNo: str(row.accountNo), ifsc: str(row.ifsc) };
    }
    return out;
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
        rows.push({ billId: row.billId, billAccYear: row.billAccYear, amount: num(row.amount) });
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
function str(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
//# sourceMappingURL=payment-draft-lines.js.map