"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerQuery = providerQuery;
exports.requireDocument = requireDocument;
const value_coercion_1 = require("../value-coercion");
async function providerQuery(pg, sql, params) {
    return (0, value_coercion_1.coerceResultRows)(await pg.queryReadOnly(sql, params));
}
function requireDocument(request, providerCode) {
    const { docId, accYear } = request.context;
    if (!docId) {
        throw new Error(`${providerCode} prints one document and the render named none. ` +
            'Send docId — it is what :doc_id binds to.');
    }
    if (!accYear) {
        throw new Error(`${providerCode} reads a table partitioned by accounting year, and the render named none. ` +
            "Send accYear ('2026-2027') — it is the document's OWN year, which for a reprint is not " +
            'necessarily the current one.');
    }
    return { docId, accYear };
}
//# sourceMappingURL=provider.utils.js.map