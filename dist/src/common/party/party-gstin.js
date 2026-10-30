"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullableUpperPattern = exports.PARTY_PAN_PATTERN = exports.PARTY_GSTIN_PATTERN = exports.PARTY_GSTIN_PATTERNS = void 0;
exports.gstinKindOf = gstinKindOf;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../dto/dtoDecorators");
exports.PARTY_GSTIN_PATTERNS = {
    NORMAL: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    TDS_DEDUCTOR: /^[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z][1-9A-Z]D[0-9A-Z]$/,
    UIN: /^[0-9]{4}[A-Z]{3}[0-9]{5}[UO]N[0-9A-Z]$/,
    OIDAR: /^99[0-9]{2}[A-Z]{3}[0-9]{5}OS[0-9A-Z]$/,
    NRTP: /^[0-9]{4}[A-Z]{3}[0-9]{5}NR[0-9A-Z]$/,
};
function gstinKindOf(gstin) {
    for (const kind of Object.keys(exports.PARTY_GSTIN_PATTERNS)) {
        if (exports.PARTY_GSTIN_PATTERNS[kind].test(gstin)) {
            return kind;
        }
    }
    return null;
}
exports.PARTY_GSTIN_PATTERN = new RegExp(`^(?:${Object.values(exports.PARTY_GSTIN_PATTERNS)
    .map((pattern) => pattern.source.slice(1, -1))
    .join('|')})$`);
exports.PARTY_PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const toNullableUpperStrict = (value) => {
    if (value === undefined || value === null || typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim().toUpperCase();
    return trimmed ? trimmed : null;
};
const NullableUpperPattern = (maxLength, constraint, pattern, what) => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(({ value }) => toNullableUpperStrict(value)), (0, dtoDecorators_1.SkipOnNullish)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(maxLength), (0, class_validator_1.ValidateBy)({
    name: constraint,
    validator: {
        validate: (value) => typeof value === 'string' && pattern.test(value),
        defaultMessage: (args) => `${args?.property ?? 'value'} must be ${what}`,
    },
}));
exports.NullableUpperPattern = NullableUpperPattern;
//# sourceMappingURL=party-gstin.js.map