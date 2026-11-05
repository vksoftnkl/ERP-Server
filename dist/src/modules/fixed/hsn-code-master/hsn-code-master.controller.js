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
exports.HsnCodeMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_hsn_code_master_query_dto_1 = require("./dto/get-hsn-code-master-query.dto");
const hsn_code_master_response_dto_1 = require("./dto/hsn-code-master-response.dto");
const hsn_code_master_service_1 = require("./hsn-code-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let HsnCodeMasterController = class HsnCodeMasterController {
    hsnCodeMasterService;
    constructor(hsnCodeMasterService) {
        this.hsnCodeMasterService = hsnCodeMasterService;
    }
    async get(queryDto) {
        const result = await this.hsnCodeMasterService.get(queryDto);
        return {
            success: true,
            message: queryDto.hsnId !== undefined || Boolean(queryDto.hsnCode)
                ? 'HSN code fetched successfully'
                : 'HSN codes fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
};
exports.HsnCodeMasterController = HsnCodeMasterController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get HSN code records from fixed.hsn_master by hsnId/hsnCode or filters. Defaults to active records only.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: hsn_code_master_response_dto_1.HsnCodeMasterSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: hsn_code_master_response_dto_1.HsnCodeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: hsn_code_master_response_dto_1.HsnCodeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_hsn_code_master_query_dto_1.GetHsnCodeMasterQueryDto]),
    __metadata("design:returntype", Promise)
], HsnCodeMasterController.prototype, "get", null);
exports.HsnCodeMasterController = HsnCodeMasterController = __decorate([
    (0, swagger_1.ApiTags)('HSN Code Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('hsn-code-masters'),
    __metadata("design:paramtypes", [hsn_code_master_service_1.HsnCodeMasterService])
], HsnCodeMasterController);
//# sourceMappingURL=hsn-code-master.controller.js.map