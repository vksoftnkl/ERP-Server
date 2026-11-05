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
exports.GetTenderDetailQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const tender_detail_api_types_1 = require("../types/tender-detail-api.types");
class GetTenderDetailQueryDto {
    tdId;
    tdSrcModule;
    tdSrcDocType;
    tdSrcDocId;
}
exports.GetTenderDetailQueryDto = GetTenderDetailQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Fetch a single tender line by id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetTenderDetailQueryDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: tender_detail_api_types_1.TenderSrcModule,
        enumName: 'TenderSrcModule',
        description: 'Parent document module; send together with tdSrcDocType and tdSrcDocId',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    (0, class_validator_1.IsEnum)(tender_detail_api_types_1.TenderSrcModule),
    __metadata("design:type", String)
], GetTenderDetailQueryDto.prototype, "tdSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: tender_detail_api_types_1.TenderSrcDocType,
        enumName: 'TenderSrcDocType',
        description: 'Parent document kind; send together with tdSrcModule and tdSrcDocId',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(30),
    (0, class_validator_1.IsEnum)(tender_detail_api_types_1.TenderSrcDocType),
    __metadata("design:type", String)
], GetTenderDetailQueryDto.prototype, "tdSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Parent document id; send together with tdSrcModule and tdSrcDocType',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetTenderDetailQueryDto.prototype, "tdSrcDocId", void 0);
//# sourceMappingURL=get-tender-detail-query.dto.js.map