"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeTempCreditTenders = encodeTempCreditTenders;
exports.decodeTempCredit = decodeTempCredit;
exports.toTempCreditDto = toTempCreditDto;
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const NOTES_PREFIX = 'TEMP_CR:';
function encodeTempCreditTenders(tenders) {
    if (!tenders) {
        return tenders;
    }
    return tenders.map((t) => {
        const tc = t.tempCredit;
        const { tempCredit: _drop, ...rest } = t;
        void _drop;
        if (!tc) {
            return rest;
        }
        const extra = JSON.stringify({
            addr: tc.addr ?? null,
            idRef: tc.idRef ?? null,
            days: tc.days ?? 0,
            notes: tc.notes ?? null,
        });
        return {
            ...rest,
            tdBankName: tc.name,
            tdRefNo: tc.mobile,
            tdPayerVpa: tc.place ?? null,
            tdNotes: (NOTES_PREFIX + extra).slice(0, 250),
        };
    });
}
function decodeTempCredit(row) {
    if (Number(row.tdTenderTypeId) !== sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT) {
        return null;
    }
    let extra = {};
    if (row.tdNotes?.startsWith(NOTES_PREFIX)) {
        try {
            extra = JSON.parse(row.tdNotes.slice(NOTES_PREFIX.length));
        }
        catch {
            extra = {};
        }
    }
    if (!row.tdBankName || !row.tdRefNo) {
        return null;
    }
    return {
        name: row.tdBankName,
        mobile: row.tdRefNo,
        place: row.tdPayerVpa ?? null,
        addr: extra.addr ?? null,
        idRef: extra.idRef ?? null,
        days: Number(extra.days ?? 0) || 0,
        notes: extra.notes ?? null,
    };
}
function toTempCreditDto(d) {
    return {
        name: d.name,
        mobile: d.mobile,
        place: d.place,
        addr: d.addr,
        idRef: d.idRef,
        days: d.days,
        notes: d.notes,
    };
}
//# sourceMappingURL=bill-temp-credit.js.map