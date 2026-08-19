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
exports.DeviceListMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const device_list_master_exception_filter_1 = require("./device-list-master-exception.filter");
const device_list_master_response_dto_1 = require("./dto/device-list-master-response.dto");
const list_device_list_master_query_dto_1 = require("./dto/list-device-list-master-query.dto");
const save_device_list_master_dto_1 = require("./dto/save-device-list-master.dto");
const device_list_master_service_1 = require("./device-list-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let DeviceListMasterController = class DeviceListMasterController {
    deviceListMasterService;
    constructor(deviceListMasterService) {
        this.deviceListMasterService = deviceListMasterService;
    }
    async save(saveDeviceListMasterDto) {
        const data = await this.deviceListMasterService.save(saveDeviceListMasterDto);
        return {
            success: true,
            message: saveDeviceListMasterDto.devId
                ? 'Device updated successfully'
                : 'Device created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.deviceListMasterService.list(queryDto);
        return {
            success: true,
            message: 'Devices fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(devId) {
        const data = await this.deviceListMasterService.getById(devId);
        return {
            success: true,
            message: 'Device fetched successfully',
            data,
        };
    }
    async remove(devId) {
        const data = await this.deviceListMasterService.softDelete(devId);
        return {
            success: true,
            message: 'Device deleted successfully',
            data,
        };
    }
};
exports.DeviceListMasterController = DeviceListMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update device (by devId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: device_list_master_response_dto_1.DeviceListMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_device_list_master_dto_1.SaveDeviceListMasterDto]),
    __metadata("design:returntype", Promise)
], DeviceListMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List devices with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: device_list_master_response_dto_1.DeviceListMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_device_list_master_query_dto_1.ListDeviceListMasterQueryDto]),
    __metadata("design:returntype", Promise)
], DeviceListMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get device by id' }),
    (0, swagger_1.ApiQuery)({ name: 'devId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: device_list_master_response_dto_1.DeviceListMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('devId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeviceListMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete device by id' }),
    (0, swagger_1.ApiQuery)({ name: 'devId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: device_list_master_response_dto_1.DeviceListMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: device_list_master_response_dto_1.DeviceListMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('devId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeviceListMasterController.prototype, "remove", null);
exports.DeviceListMasterController = DeviceListMasterController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('Device List Master'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('device-list-masters'),
    (0, common_1.UseFilters)(device_list_master_exception_filter_1.DeviceListMasterExceptionFilter),
    __metadata("design:paramtypes", [device_list_master_service_1.DeviceListMasterService])
], DeviceListMasterController);
//# sourceMappingURL=device-list-master.controller.js.map