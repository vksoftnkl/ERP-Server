"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VCH = void 0;
exports.newGuardContext = newGuardContext;
exports.refuse = refuse;
exports.warn = warn;
exports.throwRefusals = throwRefusals;
exports.throwRefused = throwRefused;
exports.throwRight = throwRight;
exports.throwState = throwState;
exports.throwMissing = throwMissing;
exports.throwInvalid = throwInvalid;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.VCH = {
    RIGHT_VIEW: 'VCH_RIGHT_VIEW',
    RIGHT_CREATE: 'VCH_RIGHT_CREATE',
    RIGHT_EDIT: 'VCH_RIGHT_EDIT',
    RIGHT_DELETE: 'VCH_RIGHT_DELETE',
    RIGHT_POST: 'VCH_RIGHT_POST',
    RIGHT_CANCEL: 'VCH_RIGHT_CANCEL',
    RIGHT_OVERRIDE: 'VCH_RIGHT_OVERRIDE',
    UNBALANCED: 'VCH_UNBALANCED',
    NO_LINES: 'VCH_NO_LINES',
    LINE_AMOUNT: 'VCH_LINE_AMOUNT',
    LEDGER_SIDE: 'VCH_LEDGER_SIDE',
    LEDGER_INACTIVE: 'VCH_LEDGER_INACTIVE',
    LEDGER_NOT_FOUND: 'VCH_LEDGER_NOT_FOUND',
    INSTRUMENT_LEDGER: 'VCH_INSTRUMENT_LEDGER',
    PARTY_MODE: 'VCH_PARTY_MODE',
    PARTY_NOT_FOUND: 'VCH_PARTY_NOT_FOUND',
    BILLWISE_SHORT: 'VCH_BILLWISE_SHORT',
    BILL_OVERSPENT: 'VCH_BILL_OVERSPENT',
    BILL_NOT_FOUND: 'VCH_BILL_NOT_FOUND',
    BILL_WRONG_PARTY: 'VCH_BILL_WRONG_PARTY',
    BILL_WRONG_SIDE: 'VCH_BILL_WRONG_SIDE',
    ALLOCATION_LINE: 'VCH_ALLOCATION_LINE',
    PERIOD_LOCKED: 'VCH_PERIOD_LOCKED',
    YEAR_CLOSED: 'VCH_YEAR_CLOSED',
    DATE_OUTSIDE_YEAR: 'VCH_DATE_OUTSIDE_YEAR',
    TYPE_NOT_REGISTER: 'VCH_TYPE_NOT_REGISTER',
    TYPE_INVENTORY: 'VCH_TYPE_INVENTORY',
    GST_RATE_MISSING: 'VCH_GST_RATE_MISSING',
    GST_LEDGER_UNMAPPED: 'VCH_GST_LEDGER_UNMAPPED',
    GST_LEDGER_TYPED: 'VCH_GST_LEDGER_TYPED',
    GST_NOT_ALLOWED: 'VCH_GST_NOT_ALLOWED',
    TDS_UNMAPPED: 'VCH_TDS_UNMAPPED',
    TDS_RATE_MISSING: 'VCH_TDS_RATE_MISSING',
    TDS_BELOW_THRESHOLD: 'VCH_TDS_BELOW_THRESHOLD',
    TDS_DEPOSITED: 'VCH_TDS_DEPOSITED',
    IRN_LIVE: 'VCH_IRN_LIVE',
    ALLOCATED_ELSEWHERE: 'VCH_ALLOCATED_ELSEWHERE',
    NOT_DRAFT: 'VCH_NOT_DRAFT',
    NOT_POSTED: 'VCH_NOT_POSTED',
    POSTED: 'VCH_POSTED',
    CANCELLED: 'VCH_CANCELLED',
    NOT_FOUND: 'VCH_NOT_FOUND',
    BACKDATED: 'VCH_BACKDATED',
    DUP_DOC_REFNO: 'VCH_DUP_DOC_REFNO',
    DOC_REFNO_REQUIRED: 'VCH_DOC_REFNO_REQUIRED',
    INVALID: 'VCH_INVALID',
};
function newGuardContext(opts) {
    return {
        dryRun: opts.dryRun,
        overrides: opts.overrides ?? [],
        canOverride: opts.canOverride,
        refusals: [],
        warnings: [],
    };
}
function refuse(ctx, code, message, opts = {}) {
    ctx.refusals.push({ code, message, field: opts.field, line: opts.line });
}
function warn(ctx, code, message, opts = {}) {
    const overridable = opts.overridable ?? true;
    const accepted = overridable && ctx.overrides.includes(code) && ctx.canOverride;
    ctx.warnings.push({
        code,
        level: accepted ? 'INFO' : 'WARN',
        message,
        field: opts.field,
        line: opts.line,
        overridable,
    });
    if (accepted || (overridable && ctx.dryRun)) {
        return;
    }
    refuse(ctx, code, message, opts);
}
function throwRefusals(message, refusals) {
    (0, module_service_utils_1.throwUnprocessable)(message, refusals.map((r) => ({
        field: r.field ?? 'document',
        message: r.message,
        code: r.code,
        ...(r.line === undefined ? {} : { line: r.line }),
    })));
}
function throwRefused(message, code, field = 'document') {
    (0, module_service_utils_1.throwUnprocessable)(message, [{ field, message, code }]);
}
function throwRight(message, code, field = 'userId') {
    (0, module_service_utils_1.throwAccountsForbidden)(message, [{ field, message, code }]);
}
function throwState(message, code, field = 'voucherId') {
    (0, module_service_utils_1.throwAccountsConflict)(message, [{ field, message, code }]);
}
function throwMissing(message, code, field = 'voucherId') {
    throw new common_1.NotFoundException((0, module_service_utils_1.buildAccountsErrorResponse)(message, [{ field, message, code }]));
}
function throwInvalid(message, code, field = 'document') {
    (0, module_service_utils_1.throwAccountsBadRequest)(message, [{ field, message, code }]);
}
//# sourceMappingURL=vouchers.errors.js.map