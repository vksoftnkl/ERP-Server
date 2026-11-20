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
exports.MobileBankController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_bank_dto_1 = require("./dto/mobile-bank.dto");
const mobile_bank_response_dto_1 = require("./dto/mobile-bank-response.dto");
const mobile_bank_service_1 = require("./mobile-bank.service");
let MobileBankController = class MobileBankController {
    mobileBankService;
    constructor(mobileBankService) {
        this.mobileBankService = mobileBankService;
    }
    async list(query) {
        const data = await this.mobileBankService.list(query);
        return { success: true, message: 'Banks fetched successfully', data };
    }
};
exports.MobileBankController = MobileBankController;
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiSecurity)({}),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'The banks a cheque can be drawn on, for the phone cheque Bank dropdown',
        description: 'fixed.bank_master rows that are active and not deleted, by name (the rows of the ' +
            "desktop's bank popup, grid 111). Not paged: the whole list in one answer. The phone " +
            'sends the NAME as tdBankName; td_bank_name is a varchar, not a key.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_bank_response_dto_1.MobileBankListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'deviceUid missing' }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Phone not registered, blocked or inactive (MOBILE_DEVICE_*)',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_bank_dto_1.MobileBankListQueryDto]),
    __metadata("design:returntype", Promise)
], MobileBankController.prototype, "list", null);
exports.MobileBankController = MobileBankController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Banks'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('mobile/banks'),
    __metadata("design:paramtypes", [mobile_bank_service_1.MobileBankService])
], MobileBankController);
//# sourceMappingURL=mobile-bank.controller.js.map