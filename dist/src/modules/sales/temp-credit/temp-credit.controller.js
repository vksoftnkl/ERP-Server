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
exports.TempCreditController = exports.TempCreditExceptionFilter = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const module_exception_filter_utils_1 = require("../../../common/utils/module-exception-filter.utils");
const temp_credit_dto_1 = require("./dto/temp-credit.dto");
const temp_credit_service_1 = require("./temp-credit.service");
let TempCreditExceptionFilter = class TempCreditExceptionFilter extends module_exception_filter_utils_1.SalesExceptionFilter {
    constructor() {
        super(/\b(atc[A-Za-z0-9]+|companyId|branchId|status|search|overdueOnly|promiseDate|remarks)\b/);
    }
};
exports.TempCreditExceptionFilter = TempCreditExceptionFilter;
exports.TempCreditExceptionFilter = TempCreditExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [])
], TempCreditExceptionFilter);
let TempCreditController = class TempCreditController {
    service;
    constructor(service) {
        this.service = service;
    }
    async open(q) {
        return {
            success: true,
            message: 'Temporary credits fetched',
            data: await this.service.open(q),
        };
    }
    async followUp(dto) {
        return { success: true, message: 'Follow-up recorded', data: await this.service.followUp(dto) };
    }
};
exports.TempCreditController = TempCreditController;
__decorate([
    (0, common_1.Get)('open'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Grid rows of accounts.acc_temp_credit with daysOverdue' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [temp_credit_dto_1.OpenTempCreditsQueryDto]),
    __metadata("design:returntype", Promise)
], TempCreditController.prototype, "open", null);
__decorate([
    (0, common_1.Put)('follow-up'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Record a follow-up (promise date, remarks) on a temporary credit' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [temp_credit_dto_1.TempCreditFollowUpDto]),
    __metadata("design:returntype", Promise)
], TempCreditController.prototype, "followUp", null);
exports.TempCreditController = TempCreditController = __decorate([
    (0, swagger_1.ApiTags)('Temporary Credits'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('temp-credits'),
    (0, common_1.UseFilters)(TempCreditExceptionFilter),
    __metadata("design:paramtypes", [temp_credit_service_1.TempCreditService])
], TempCreditController);
//# sourceMappingURL=temp-credit.controller.js.map