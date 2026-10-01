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
exports.StockAdminController = exports.BalanceAssertionQueryDto = exports.PostMissingVouchersQueryDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_admin_service_1 = require("./stock-admin.service");
class PostMissingVouchersQueryDto {
    companyId;
    accYear;
}
exports.PostMissingVouchersQueryDto = PostMissingVouchersQueryDto;
__decorate([
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], PostMissingVouchersQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}-\d{4}$/, { message: 'accYear must be YYYY-YYYY' }),
    __metadata("design:type", String)
], PostMissingVouchersQueryDto.prototype, "accYear", void 0);
class BalanceAssertionQueryDto {
    companyId;
    branchId;
    itemId;
}
exports.BalanceAssertionQueryDto = BalanceAssertionQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], BalanceAssertionQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], BalanceAssertionQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], BalanceAssertionQueryDto.prototype, "itemId", void 0);
let StockAdminController = class StockAdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    async postMissingVouchers(query) {
        const data = await this.admin.postMissingVouchers(query.companyId, query.accYear);
        return {
            success: true,
            message: `${data.posted} accounts vouchers written for ${data.walked} stock documents`,
            data,
        };
    }
    async balanceAssertion(query) {
        const data = await this.admin.assertBalances(query);
        return {
            success: true,
            message: data.length ? `${data.length} findings` : 'Every derived figure agrees with its source',
            data,
        };
    }
};
exports.StockAdminController = StockAdminController;
__decorate([
    (0, common_1.Post)('post-missing-vouchers'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the accounts voucher for every POSTED stock document that has none (PERPETUAL)',
        description: 'Go-live step for stock → accounts. Reads first, so running it twice writes nothing the second time. Under PERIODIC it posts nothing.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'How many documents were walked and how many vouchers were written.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PostMissingVouchersQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdminController.prototype, "postMissingVouchers", null);
__decorate([
    (0, common_1.Get)('balance-assertion'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Compare every derived stock figure to its source — detect, never fix',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The findings; an empty list is a clean book.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BalanceAssertionQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdminController.prototype, "balanceAssertion", null);
exports.StockAdminController = StockAdminController = __decorate([
    (0, swagger_1.ApiTags)('Stock Admin'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('stock/admin'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_admin_service_1.StockAdminService])
], StockAdminController);
//# sourceMappingURL=stock-admin.controller.js.map