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
exports.CancelBillDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class CancelBillDto {
    sbId;
    sbCompanyId;
    sbBranchId;
    sbAccYear;
    remarks;
    username;
}
exports.CancelBillDto = CancelBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "sbCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "sbBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "sbAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 250,
        description: 'Why the order is being cancelled. Written to sale_order_item.soi_cancel_reason on ' +
            'every line this call closes out, and to the status trail ' +
            '(public.txn_status_log.tsl_remarks) — which sale_order has no reason column of its own ' +
            'for, by design.',
    }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 50,
        description: 'Who is cancelling. Recorded as the actor on every row this call writes.',
    }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelBillDto.prototype, "username", void 0);
//# sourceMappingURL=cancel-bill.dto.js.map