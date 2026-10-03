"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteOnlySecret = exports.NullableDateOnly = exports.DateOnly = exports.NullableUpperEnum = exports.OptionalUpperEnum = exports.UpperEnum = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ONLY_MESSAGE = { message: '$property must be a date as YYYY-MM-DD' };
const oneOf = (values) => ({
    message: `$property must be one of: ${values.join(', ')}`,
});
const UpperEnum = (values) => (0, common_1.applyDecorators)((0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toUpperTrimmed)(value)), (0, class_validator_1.IsIn)(values, oneOf(values)));
exports.UpperEnum = UpperEnum;
const OptionalUpperEnum = (values) => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, exports.UpperEnum)(values));
exports.OptionalUpperEnum = OptionalUpperEnum;
const NullableUpperEnum = (values) => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(({ value }) => {
    const text = (0, dtoDecorators_1.toNullableStringStrict)(value);
    return typeof text === 'string' ? text.toUpperCase() : text;
}), (0, dtoDecorators_1.SkipOnNullish)(), (0, class_validator_1.IsIn)(values, oneOf(values)));
exports.NullableUpperEnum = NullableUpperEnum;
const DateOnly = () => (0, common_1.applyDecorators)((0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toNullableStringStrict)(value)), (0, class_validator_1.IsString)(), (0, class_validator_1.Matches)(DATE_ONLY, DATE_ONLY_MESSAGE), (0, class_validator_1.IsDateString)());
exports.DateOnly = DateOnly;
const NullableDateOnly = () => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toNullableStringStrict)(value)), (0, dtoDecorators_1.SkipOnNullish)(), (0, class_validator_1.IsString)(), (0, class_validator_1.Matches)(DATE_ONLY, DATE_ONLY_MESSAGE), (0, class_validator_1.IsDateString)());
exports.NullableDateOnly = NullableDateOnly;
const WriteOnlySecret = (maxLength = 500) => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(maxLength));
exports.WriteOnlySecret = WriteOnlySecret;
//# sourceMappingURL=gst-dto.decorators.js.map