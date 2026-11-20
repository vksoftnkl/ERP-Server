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
exports.MobileMeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_me_response_dto_1 = require("./dto/mobile-me-response.dto");
const mobile_me_service_1 = require("./mobile-me.service");
let MobileMeController = class MobileMeController {
    mobileMeService;
    constructor(mobileMeService) {
        this.mobileMeService = mobileMeService;
    }
    async me() {
        const data = await this.mobileMeService.me();
        return { success: true, message: 'Login fetched successfully', data };
    }
};
exports.MobileMeController = MobileMeController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'The signed-in login: its employee (the receipt collector) and its rights',
        description: 'userId, loginName, employeeId / employeeName (user_master.usr_employee_id when it names a ' +
            'live employee, else null) and rights keyed by menu id as text: "11" Sales Order, "12" ' +
            'Sales Bill, "99" Receipt, each {view, create, post, cancel, print} from public.user_menus ' +
            'as the desktop guards read them (no row = all false). Needs a token; 401 ' +
            'AUTH_USER_INACTIVE when the login has been deleted since the token was issued.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_me_response_dto_1.MobileMeSuccessDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MobileMeController.prototype, "me", null);
exports.MobileMeController = MobileMeController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Me'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('mobile/me'),
    __metadata("design:paramtypes", [mobile_me_service_1.MobileMeService])
], MobileMeController);
//# sourceMappingURL=mobile-me.controller.js.map