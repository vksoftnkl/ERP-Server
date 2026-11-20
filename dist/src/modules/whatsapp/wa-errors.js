"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaRelayError = exports.WA_HOUSE_CODES = void 0;
exports.waHttpStatus = waHttpStatus;
exports.waRefuse = waRefuse;
exports.waRefuseMany = waRefuseMany;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const wa_constants_1 = require("./wa.constants");
exports.WA_HOUSE_CODES = {
    COMPANY_NOT_FOUND: 'LOOKUP_COMPANY_NOT_FOUND',
    KIND_NOT_SENT: 'VALIDATION_IS_IN',
};
const C = wa_constants_1.WA_CODES;
const STATUS_OF = {
    [C.RIGHT_VIEW]: 403,
    [C.RIGHT_EDIT]: 403,
    [C.RIGHT_POST]: 403,
    [C.RIGHT_PRINT]: 403,
    [C.KEY_MISSING]: 503,
    [C.RELAY_NOT_SET]: 503,
    [C.RELAY_UNREACHABLE]: 503,
    [C.RELAY_BUSY]: 503,
    [C.RELAY_ERROR]: 503,
    [C.RELAY_BAD_REQUEST]: 400,
    [C.ACTIVATION_INVALID]: 422,
    [C.SETTING_INVALID]: 400,
    [C.DOC_NOT_FOUND]: 404,
    [C.PARTY_NOT_FOUND]: 404,
    [C.BAD_NUMBER]: 400,
    [C.BATCH_EMPTY]: 400,
    [C.BATCH_TOO_BIG]: 400,
    [C.ALLOW_AGAIN_CONFIRM]: 400,
    [exports.WA_HOUSE_CODES.COMPANY_NOT_FOUND]: 404,
    [exports.WA_HOUSE_CODES.KIND_NOT_SENT]: 400,
};
function waHttpStatus(code) {
    return STATUS_OF[code] ?? 409;
}
function waRefuse(code, message, field = 'request', extra = {}) {
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [{ field, code, message, ...extra }]), waHttpStatus(code));
}
function waRefuseMany(message, details) {
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, details), waHttpStatus(details[0]?.code ?? ''));
}
class WaRelayError extends Error {
    waCode;
    relay;
    constructor(waCode, message, relay) {
        super(message);
        this.waCode = waCode;
        this.relay = relay;
        this.name = 'WaRelayError';
    }
    get unconfirmed() {
        return this.relay.relayCode === wa_constants_1.RELAY_CODES.SEND_UNCONFIRMED;
    }
}
exports.WaRelayError = WaRelayError;
//# sourceMappingURL=wa-errors.js.map