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
exports.GstCompanyCredentialIdDto = exports.GstProviderAccountIdDto = exports.GstProviderErrorMapIdDto = exports.GstProviderFieldMapIdDto = exports.GstProviderEndpointIdDto = exports.GstProviderServiceIdDto = exports.GstProviderIdDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
class GstProviderIdDto {
    gpvId;
}
exports.GstProviderIdDto = GstProviderIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstProviderIdDto.prototype, "gpvId", void 0);
class GstProviderServiceIdDto {
    gpsId;
}
exports.GstProviderServiceIdDto = GstProviderServiceIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstProviderServiceIdDto.prototype, "gpsId", void 0);
class GstProviderEndpointIdDto {
    gpeId;
}
exports.GstProviderEndpointIdDto = GstProviderEndpointIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstProviderEndpointIdDto.prototype, "gpeId", void 0);
class GstProviderFieldMapIdDto {
    gfmId;
}
exports.GstProviderFieldMapIdDto = GstProviderFieldMapIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstProviderFieldMapIdDto.prototype, "gfmId", void 0);
class GstProviderErrorMapIdDto {
    gemId;
}
exports.GstProviderErrorMapIdDto = GstProviderErrorMapIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstProviderErrorMapIdDto.prototype, "gemId", void 0);
class GstProviderAccountIdDto {
    gpaId;
}
exports.GstProviderAccountIdDto = GstProviderAccountIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstProviderAccountIdDto.prototype, "gpaId", void 0);
class GstCompanyCredentialIdDto {
    gccId;
}
exports.GstCompanyCredentialIdDto = GstCompanyCredentialIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GstCompanyCredentialIdDto.prototype, "gccId", void 0);
//# sourceMappingURL=gst-ids.dto.js.map