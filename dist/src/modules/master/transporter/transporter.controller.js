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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransporterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const save_transporter_dto_1 = require("./dto/save-transporter.dto");
const transporter_ref_dto_1 = require("./dto/transporter-ref.dto");
const transporter_exception_filter_1 = require("./transporter-exception.filter");
const transporter_service_1 = require("./transporter.service");
let TransporterController = class TransporterController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return { success: true, message: `Transporter ${data.name} saved`, data };
    }
    async get(q) {
        return { success: true, message: 'Transporter fetched', data: await this.service.getById(q.trnId) };
    }
    async remove(dto) {
        const { name, ...data } = await this.service.softDelete(dto.trnId);
        return { success: true, message: `Transporter ${name} deleted`, data };
    }
};
exports.TransporterController = TransporterController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create (no trnId; makes its own ledger under Transporters) or update a transporter (its ledger follows).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_transporter_dto_1.SaveTransporterDto]),
    __metadata("design:returntype", Promise)
], TransporterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One transporter with its state, ledger and how many vehicles name it.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transporter_ref_dto_1.TransporterRefDto]),
    __metadata("design:returntype", Promise)
], TransporterController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a transporter and its ledger, only at a zero balance with no cheque in hand.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transporter_ref_dto_1.TransporterRefDto]),
    __metadata("design:returntype", Promise)
], TransporterController.prototype, "remove", null);
exports.TransporterController = TransporterController = __decorate([
    (0, swagger_1.ApiTags)('Transporters'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('transporters'),
    (0, common_1.UseFilters)(transporter_exception_filter_1.TransporterExceptionFilter),
    __metadata("design:paramtypes", [transporter_service_1.TransporterService])
], TransporterController);
//# sourceMappingURL=transporter.controller.js.map