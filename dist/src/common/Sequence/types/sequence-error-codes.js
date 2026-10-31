"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequenceErrorCode = void 0;
var SequenceErrorCode;
(function (SequenceErrorCode) {
    SequenceErrorCode["NOT_FOUND"] = "SEQUENCE_NOT_FOUND";
    SequenceErrorCode["VOUCHER_TYPE_NOT_FOUND"] = "SEQUENCE_VOUCHER_TYPE_NOT_FOUND";
    SequenceErrorCode["COMPANY_NOT_FOUND"] = "SEQUENCE_COMPANY_NOT_FOUND";
    SequenceErrorCode["BRANCH_NOT_FOUND"] = "SEQUENCE_BRANCH_NOT_FOUND";
    SequenceErrorCode["SCOPE_DUPLICATE"] = "SEQUENCE_SCOPE_DUPLICATE";
    SequenceErrorCode["INACTIVE"] = "SEQUENCE_INACTIVE";
    SequenceErrorCode["REFNO_TOO_LONG"] = "SEQUENCE_REFNO_TOO_LONG";
    SequenceErrorCode["FIELD_NOT_UUID"] = "VALIDATION_IS_UUID";
    SequenceErrorCode["FIELD_NOT_STRING"] = "VALIDATION_IS_STRING";
    SequenceErrorCode["FIELD_EMPTY"] = "VALIDATION_IS_NOT_EMPTY";
    SequenceErrorCode["FIELD_TOO_LONG"] = "VALIDATION_MAX_LENGTH";
    SequenceErrorCode["FIELD_BELOW_MIN"] = "VALIDATION_MIN";
    SequenceErrorCode["FIELD_ABOVE_MAX"] = "VALIDATION_MAX";
    SequenceErrorCode["FIELD_NOT_INTEGER"] = "VALIDATION_IS_INT";
    SequenceErrorCode["FIELD_NOT_BOOLEAN"] = "VALIDATION_IS_BOOLEAN";
})(SequenceErrorCode || (exports.SequenceErrorCode = SequenceErrorCode = {}));
//# sourceMappingURL=sequence-error-codes.js.map