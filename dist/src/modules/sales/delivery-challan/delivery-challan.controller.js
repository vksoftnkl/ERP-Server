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
exports.DeliveryChallanController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const delivery_challan_exception_filter_1 = require("./delivery-challan-exception.filter");
const delivery_challan_service_1 = require("./delivery-challan.service");
const save_delivery_challan_dto_1 = require("./dto/save-delivery-challan.dto");
const delivery_challan_lifecycle_dto_1 = require("./dto/delivery-challan-lifecycle.dto");
const ok = (message, data) => ({ success: true, message, data });
let DeliveryChallanController = class DeliveryChallanController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        return ok(dto.sdcId ? 'Challan updated successfully' : 'Challan created successfully', await this.service.save(dto));
    }
    async validate(dto) {
        return ok('Challan validated', await this.service.validate(dto));
    }
    async post(dto) {
        return ok('Challan posted successfully', await this.service.post(dto));
    }
    async cancel(dto) {
        return ok('Challan cancelled successfully', await this.service.cancel(dto));
    }
    async amend(dto) {
        return ok('Challan amended successfully', await this.service.amend(dto));
    }
    async remove(dto) {
        return ok('Draft challan deleted successfully', await this.service.delete(dto));
    }
    async get(sdcId, sdcCompanyId, sdcBranchId, sdcAccYear) {
        return ok('Challan fetched successfully', await this.service.get({
            id: sdcId,
            companyId: sdcCompanyId,
            branchId: sdcBranchId,
            accYear: sdcAccYear,
        }));
    }
    async openForBill(companyId, branchId, partyId, accYear) {
        return ok('Open challans fetched', await this.service.openForBill({ companyId, branchId, partyId, accYear: accYear || null }));
    }
    async convertPurpose(dto) {
        return ok('Purpose converted', await this.service.convertPurpose(dto));
    }
    async transport(dto) {
        return ok('Transport details saved', await this.service.transport(dto));
    }
};
exports.DeliveryChallanController = DeliveryChallanController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update a DRAFT challan (by sdcId presence)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_delivery_challan_dto_1.SaveDeliveryChallanDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Dry-run the post. Writes nothing.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.ValidateDeliveryChallanDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post a DRAFT challan: stock out (DC_ISSUE), COGS pair under PERPETUAL, e-way register row',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.PostDeliveryChallanDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a POSTED challan by reversal (SALES_DC_BILLED / SALES_DC_RETURNED refuse it)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.CancelDeliveryChallanDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('amend'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Amend a POSTED challan (no e-way bill yet): unwind, re-apply, re-post, revision + 1',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.AmendDeliveryChallanDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "amend", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a DRAFT challan' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.DeliveryChallanKeysDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get a challan — header, items, charges, transport, posting, locks (with editable.purpose), rights',
    }),
    (0, swagger_1.ApiQuery)({ name: 'sdcId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdcCompanyId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdcBranchId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdcAccYear' }),
    __param(0, (0, common_1.Query)('sdcId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sdcCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sdcBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sdcAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('open-for-bill'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Open challan lines of a party a bill can take (= /bills/open-sources?kind=DC)',
    }),
    (0, swagger_1.ApiQuery)({ name: 'companyId' }),
    (0, swagger_1.ApiQuery)({ name: 'branchId' }),
    (0, swagger_1.ApiQuery)({ name: 'partyId' }),
    (0, swagger_1.ApiQuery)({ name: 'accYear', required: false }),
    __param(0, (0, common_1.Query)('companyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('branchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('partyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('accYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "openForBill", null);
__decorate([
    (0, common_1.Post)('convert-purpose'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Change the purpose of a POSTED challan (refused after the e-way bill, or once billed / returned)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.ConvertPurposeDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "convertPurpose", null);
__decorate([
    (0, common_1.Put)('transport'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The transport band on its own verb; refused after the e-way bill (GST_DECLARED_LOCKED)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_challan_lifecycle_dto_1.DeliveryChallanTransportDto]),
    __metadata("design:returntype", Promise)
], DeliveryChallanController.prototype, "transport", null);
exports.DeliveryChallanController = DeliveryChallanController = __decorate([
    (0, swagger_1.ApiTags)('Delivery Challans'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('delivery-challans'),
    (0, common_1.UseFilters)(delivery_challan_exception_filter_1.DeliveryChallanExceptionFilter),
    __metadata("design:paramtypes", [delivery_challan_service_1.DeliveryChallanService])
], DeliveryChallanController);
//# sourceMappingURL=delivery-challan.controller.js.map