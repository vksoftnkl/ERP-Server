"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentNumberQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const master_lookup_api_types_1 = require("../types/master-lookup-api.types");
const normalizeModuleAlias = (value) => value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const MODULE_ALIAS_MAP = Object.fromEntries(master_lookup_api_types_1.DOCUMENT_LOOKUP_MODULE_KEYS.flatMap((moduleKey) => [moduleKey, ...master_lookup_api_types_1.DOCUMENT_LOOKUP_MODULE_ALIASES[moduleKey]].map((alias) => [
    normalizeModuleAlias(alias),
    moduleKey,
])));
const toDocumentModule = (value) => {
    if (typeof value !== 'string') {
        return value === undefined || value === null ? undefined : value;
    }
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    return MODULE_ALIAS_MAP[normalizeModuleAlias(trimmed)] ?? trimmed;
};
class DocumentNumberQueryDto {
    module;
    orderNo;
    companyId;
    branchId;
}
exports.DocumentNumberQueryDto = DocumentNumberQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: master_lookup_api_types_1.DOCUMENT_LOOKUP_MODULE_KEYS,
        description: 'Which document table the number is read from. Also accepts display aliases such as sale-bill, invoice, order and quotation.',
    }),
    (0, class_transformer_1.Transform)(({ value }) => toDocumentModule(value)),
    (0, class_validator_1.IsIn)(master_lookup_api_types_1.DOCUMENT_LOOKUP_MODULE_KEYS, {
        message: `module must be one of: ${master_lookup_api_types_1.DOCUMENT_LOOKUP_MODULE_KEYS.join(', ')}`,
    }),
    __metadata("design:type", String)
], DocumentNumberQueryDto.prototype, "module", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 100,
        description: 'The document number as printed on it — sb_bill_refno / so_order_refno / sq_quote_refno. An all-digits value is matched against the serial (sb_bill_slno / so_order_slno / sq_quote_slno) as well, so a screen that shows the bare running number resolves too.',
        example: 'quo00042',
    }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)({ message: 'orderNo should not be empty' }),
    __metadata("design:type", String)
], DocumentNumberQueryDto.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Company the document was raised under' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DocumentNumberQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Branch the document was raised at' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DocumentNumberQueryDto.prototype, "branchId", void 0);
//# sourceMappingURL=document-number-query.dto.js.map