"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSPORTER_RIGHT_PREFIX = exports.TransporterErrorCode = void 0;
var TransporterErrorCode;
(function (TransporterErrorCode) {
    TransporterErrorCode["NAME_REQUIRED"] = "TRN_NAME_REQUIRED";
    TransporterErrorCode["GSTIN_INVALID"] = "TRN_GSTIN_INVALID";
    TransporterErrorCode["NAME_TAKEN"] = "TRN_NAME_TAKEN";
    TransporterErrorCode["NOT_FOUND"] = "TRN_NOT_FOUND";
    TransporterErrorCode["STATE_INVALID"] = "TRN_STATE_INVALID";
    TransporterErrorCode["COMPANY_MISMATCH"] = "TRN_COMPANY_MISMATCH";
    TransporterErrorCode["LEDGER_NAME_TAKEN"] = "TRN_LEDGER_NAME_TAKEN";
    TransporterErrorCode["HAS_BALANCE"] = "TRN_HAS_BALANCE";
    TransporterErrorCode["HAS_CHEQUE_IN_HAND"] = "TRN_HAS_CHEQUE_IN_HAND";
})(TransporterErrorCode || (exports.TransporterErrorCode = TransporterErrorCode = {}));
exports.TRANSPORTER_RIGHT_PREFIX = 'TRN';
//# sourceMappingURL=transporter-error-codes.js.map