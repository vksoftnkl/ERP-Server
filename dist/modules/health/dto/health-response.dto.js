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
exports.HealthResponseDto = exports.HealthDatabaseStatusDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class HealthDatabaseStatusDto {
    status;
}
exports.HealthDatabaseStatusDto = HealthDatabaseStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['up', 'down'], example: 'up' }),
    __metadata("design:type", String)
], HealthDatabaseStatusDto.prototype, "status", void 0);
class HealthResponseDto {
    status;
    timestamp;
    database;
}
exports.HealthResponseDto = HealthResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ok', 'degraded'], example: 'ok' }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-12T14:32:10.123Z' }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthDatabaseStatusDto }),
    __metadata("design:type", HealthDatabaseStatusDto)
], HealthResponseDto.prototype, "database", void 0);
//# sourceMappingURL=health-response.dto.js.map