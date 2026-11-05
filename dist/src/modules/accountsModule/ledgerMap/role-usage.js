"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingDocument = void 0;
exports.documentsUsingRole = documentsUsingRole;
exports.describeDocuments = describeDocuments;
const cheque_enum_1 = require("../cheques/types/cheque-enum");
const opening_balance_enum_1 = require("../openingBalance/types/opening-balance-enum");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
var PostingDocument;
(function (PostingDocument) {
    PostingDocument["RECEIPT"] = "RECEIPT";
    PostingDocument["CHEQUE"] = "CHEQUE";
    PostingDocument["OPENING_BALANCE"] = "OPENING_BALANCE";
})(PostingDocument || (exports.PostingDocument = PostingDocument = {}));
const ROLES_BY_DOCUMENT = {
    [PostingDocument.RECEIPT]: Object.values(receipt_enum_1.ReceiptLedgerRole),
    [PostingDocument.CHEQUE]: Object.values(cheque_enum_1.ChequeLedgerRole),
    [PostingDocument.OPENING_BALANCE]: Object.values(opening_balance_enum_1.OpeningLedgerRole),
};
const DOCUMENTS_BY_ROLE = buildIndex();
function buildIndex() {
    const index = new Map();
    for (const [document, roles] of Object.entries(ROLES_BY_DOCUMENT)) {
        for (const role of roles) {
            const documents = index.get(role);
            if (documents) {
                documents.push(document);
            }
            else {
                index.set(role, [document]);
            }
        }
    }
    return index;
}
function documentsUsingRole(role) {
    return DOCUMENTS_BY_ROLE.get(role) ?? [];
}
function describeDocuments(documents) {
    if (documents.length <= 1) {
        return documents.join('');
    }
    return `${documents.slice(0, -1).join(', ')} and ${documents[documents.length - 1]}`;
}
//# sourceMappingURL=role-usage.js.map