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
exports.ChargeMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const charge_master_exception_filter_1 = require("./charge-master-exception.filter");
const charge_master_response_dto_1 = require("./dto/charge-master-response.dto");
const get_charge_master_query_dto_1 = require("./dto/get-charge-master-query.dto");
const save_charge_master_dto_1 = require("./dto/save-charge-master.dto");
const charge_master_service_1 = require("./charge-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let ChargeMasterController = class ChargeMasterController {
    chargeMasterService;
    constructor(chargeMasterService) {
        this.chargeMasterService = chargeMasterService;
    }
    async save(saveChargeMasterDto) {
        const data = await this.chargeMasterService.save(saveChargeMasterDto);
        return {
            success: true,
            message: saveChargeMasterDto.chgId
                ? 'Charge updated successfully'
                : 'Charge created successfully',
            data,
        };
    }
    async get(getChargeMasterQueryDto) {
        const data = await this.chargeMasterService.get(getChargeMasterQueryDto);
        return {
            success: true,
            message: Array.isArray(data) ? 'Charges fetched successfully' : 'Charge fetched successfully',
            data,
        };
    }
    async remove(chgId) {
        const data = await this.chargeMasterService.softDelete(chgId);
        return {
            success: true,
            message: 'Charge deleted successfully',
            data,
        };
    }
};
exports.ChargeMasterController = ChargeMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update charge (by chgId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: charge_master_response_dto_1.ChargeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_charge_master_dto_1.SaveChargeMasterDto]),
    __metadata("design:returntype", Promise)
], ChargeMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get charge by id, or every active charge for a module',
        description: 'Send exactly one of `chgId` (returns a single charge) or `chgModule` (returns an array). ' +
            'A module lookup also picks up `B` (both) charges: P → P + B, S → S + B, B → B.',
    }),
    (0, swagger_1.ApiExtraModels)(charge_master_response_dto_1.ChargeMasterSuccessSingleDto, charge_master_response_dto_1.ChargeMasterSuccessManyDto),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(charge_master_response_dto_1.ChargeMasterSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(charge_master_response_dto_1.ChargeMasterSuccessManyDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_charge_master_query_dto_1.GetChargeMasterQueryDto]),
    __metadata("design:returntype", Promise)
], ChargeMasterController.prototype, "get", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete charge by id' }),
    (0, swagger_1.ApiQuery)({ name: 'chgId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: charge_master_response_dto_1.ChargeMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: charge_master_response_dto_1.ChargeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('chgId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChargeMasterController.prototype, "remove", null);
exports.ChargeMasterController = ChargeMasterController = __decorate([
    (0, swagger_1.ApiTags)('Charge Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('charges'),
    (0, common_1.UseFilters)(charge_master_exception_filter_1.ChargeMasterExceptionFilter),
    __metadata("design:paramtypes", [charge_master_service_1.ChargeMasterService])
], ChargeMasterController);
//# sourceMappingURL=charge-master.controller.js.map