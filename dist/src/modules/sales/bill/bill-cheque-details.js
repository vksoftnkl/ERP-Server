"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDraftCheques = readDraftCheques;
exports.buildDraftCheques = buildDraftCheques;
exports.toDraftChequesJson = toDraftChequesJson;
exports.chequeDetailsFor = chequeDetailsFor;
const client_1 = require("@prisma/client");
const pdc_register_helper_1 = require("../posting/pdc-register.helper");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
function readDraftCheques(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const out = {};
    for (const [tdId, raw] of Object.entries(value)) {
        if (raw === null) {
            out[tdId] = null;
        }
        else if (typeof raw === 'object' && !Array.isArray(raw)) {
            const r = raw;
            out[tdId] = {
                drawerName: str(r.drawerName),
                bankBranch: str(r.bankBranch),
                ifsc: str(r.ifsc),
                micr: str(r.micr),
            };
        }
    }
    return out;
}
function buildDraftCheques(payload, persisted, prior) {
    if (!payload) {
        return undefined;
    }
    const live = new Set(persisted
        .filter((row) => !row.tdIsDeleted && Number(row.tdTenderTypeId) === sales_doc_utils_1.TENDER_TYPE.CHEQUE)
        .map((row) => row.tdId));
    const next = {};
    for (const tdId of live) {
        if (tdId in prior) {
            next[tdId] = prior[tdId];
        }
    }
    Object.assign(next, (0, pdc_register_helper_1.matchChequeDetails)(payload, persisted));
    return next;
}
function toDraftChequesJson(drafts) {
    return Object.keys(drafts).length > 0 ? drafts : client_1.Prisma.DbNull;
}
async function chequeDetailsFor(client, tenders, draft) {
    const ids = tenders
        .filter((t) => Number(t.tdTenderTypeId) === sales_doc_utils_1.TENDER_TYPE.CHEQUE)
        .map((t) => t.tdId);
    const out = new Map();
    if (ids.length === 0) {
        return out;
    }
    const drafts = readDraftCheques(draft);
    const registered = await (0, pdc_register_helper_1.readPdcChequeDetails)(client, ids);
    for (const id of ids) {
        const detail = registered.get(id) ?? drafts[id] ?? null;
        out.set(id, detail ? toDetail(detail) : null);
    }
    return out;
}
function toDetail(detail) {
    if (!detail) {
        return null;
    }
    return {
        drawerName: detail.drawerName ?? null,
        bankBranch: detail.bankBranch ?? null,
        ifsc: detail.ifsc ?? null,
        micr: detail.micr ?? null,
    };
}
function str(value) {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}
//# sourceMappingURL=bill-cheque-details.js.map