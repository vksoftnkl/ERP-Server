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
exports.VehicleController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const save_vehicle_dto_1 = require("./dto/save-vehicle.dto");
const vehicle_ref_dto_1 = require("./dto/vehicle-ref.dto");
const vehicle_exception_filter_1 = require("./vehicle-exception.filter");
const vehicle_service_1 = require("./vehicle.service");
let VehicleController = class VehicleController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return { success: true, message: `Vehicle ${data.vehicleNo} saved`, data };
    }
    async get(q) {
        return { success: true, message: 'Vehicle fetched', data: await this.service.getById(q.vehId) };
    }
    async remove(dto) {
        const { vehicleNo, ...data } = await this.service.softDelete(dto.vehId);
        return { success: true, message: `Vehicle ${vehicleNo} deleted`, data };
    }
};
exports.VehicleController = VehicleController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create (no vehId) or update a vehicle of the login company.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_vehicle_dto_1.SaveVehicleDto]),
    __metadata("design:returntype", Promise)
], VehicleController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One vehicle with its transporter, driver and home branch names.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vehicle_ref_dto_1.VehicleRefDto]),
    __metadata("design:returntype", Promise)
], VehicleController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a vehicle; saved documents keep its number.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vehicle_ref_dto_1.VehicleRefDto]),
    __metadata("design:returntype", Promise)
], VehicleController.prototype, "remove", null);
exports.VehicleController = VehicleController = __decorate([
    (0, swagger_1.ApiTags)('Vehicles'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('vehicles'),
    (0, common_1.UseFilters)(vehicle_exception_filter_1.VehicleExceptionFilter),
    __metadata("design:paramtypes", [vehicle_service_1.VehicleService])
], VehicleController);
//# sourceMappingURL=vehicle.controller.js.map