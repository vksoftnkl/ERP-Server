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
exports.ListOpeningBalanceQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class ListOpeningBalanceQueryDto {
    companyId;
    accYear;
    branchId;
    includeZero;
}
exports.ListOpeningBalanceQueryDto = ListOpeningBalanceQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpeningBalanceQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: "'YYYY-YYYY', second half = first + 1." }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ListOpeningBalanceQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Omit for the company-level set (op_branch_id IS NULL). A branch id asks for that ' +
            "branch's own set — the two coexist and ux_op_scope keeps them apart.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListOpeningBalanceQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Whether to list a ledger that has NO opening and NO prior-year closing. Defaults to ' +
            'true: the screen is a review surface over the whole chart, and on a company that has ' +
            'never been opened every ledger is in that state — so a default of false hands the ' +
            'operator an empty screen at the one moment the screen exists for. Send false to narrow ' +
            'to ledgers that have a figure or had one last year.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListOpeningBalanceQueryDto.prototype, "includeZero", void 0);
//# sourceMappingURL=list-opening-balance-query.dto.js.map