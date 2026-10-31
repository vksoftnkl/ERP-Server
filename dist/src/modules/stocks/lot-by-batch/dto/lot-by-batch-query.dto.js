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
exports.LotByBatchQueryDto = exports.LOT_BY_BATCH_BUCKETS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
exports.LOT_BY_BATCH_BUCKETS = [...stock_voucher_types_1.STOCK_BUCKETS, 'ALL'];
class LotByBatchQueryDto {
    companyId;
    branchId;
    batchNo;
    includeEmpty;
    bucket;
    godownId;
}
exports.LotByBatchQueryDto = LotByBatchQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LotByBatchQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The branch whose stock is counted.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LotByBatchQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'CBE26-00001',
        description: 'What the scanner read. Matched as the lot key folds it: trimmed, upper-cased.',
    }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LotByBatchQueryDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'true: also the lots with no stock (in the bucket asked for) at this branch.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LotByBatchQueryDto.prototype, "includeEmpty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.LOT_BY_BATCH_BUCKETS,
        default: 'SALEABLE',
        description: "Notes 150 #10 — which bucket the holdings are counted in. SALEABLE (the sale's default), one other bucket, or ALL: every bucket, each godown row then naming its bucket. The count screen scans with ALL.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.LOT_BY_BATCH_BUCKETS, {
        message: `bucket must be one of ${exports.LOT_BY_BATCH_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], LotByBatchQueryDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "Notes 150 #10 — only this godown's holdings; the lot list is unchanged.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LotByBatchQueryDto.prototype, "godownId", void 0);
//# sourceMappingURL=lot-by-batch-query.dto.js.map