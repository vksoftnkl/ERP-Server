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
exports.VoucherTypesController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const save_voucher_type_dto_1 = require("./dto/save-voucher-type.dto");
const voucher_type_query_dto_1 = require("./dto/voucher-type-query.dto");
const voucher_types_exception_filter_1 = require("./voucher-types-exception.filter");
const voucher_types_service_1 = require("./voucher-types.service");
let VoucherTypesController = class VoucherTypesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async tree(q) {
        const data = await this.service.tree(q.companyId, q.includeInactive ?? false);
        return { success: true, message: `${data.nodes.length} voucher type(s)`, data };
    }
    async get(q) {
        return { success: true, message: 'Voucher type fetched', data: await this.service.get(q) };
    }
    async validate(dto) {
        const data = await this.service.validate(dto);
        return {
            success: true,
            message: data.ok ? 'Voucher type can be saved' : 'Voucher type cannot be saved',
            data,
        };
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return { success: true, message: `Voucher type ${data.type.vchrTypeName} saved`, data };
    }
    async inactivate(dto) {
        const { name, ...data } = await this.service.inactivate(dto);
        return { success: true, message: `Voucher type ${name} made inactive`, data };
    }
    async remove(dto) {
        const { name, ...data } = await this.service.remove(dto);
        return { success: true, message: `Voucher type ${name} deleted`, data };
    }
    async clonePrintDesign(dto) {
        const data = await this.service.clonePrintDesign(dto);
        return { success: true, message: `Print design ${data.ppoCode} made`, data };
    }
};
exports.VoucherTypesController = VoucherTypesController;
__decorate([
    (0, common_1.Get)('tree'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Every base type and this company’s child types, flat (vchrParentId), with Kind and numberedBy.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_type_query_dto_1.VoucherTypeTreeQueryDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "tree", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One voucher type: row, inherited accounting, counters this year, print designs, preview.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_type_query_dto_1.VoucherTypeGetQueryDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The save body judged without writing: ok, errors[] (worded), warnings[], preview (A11).',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_voucher_type_dto_1.ValidateVoucherTypeDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a child type (no vchrTypeId) or change a type. Answers the /get payload plus warnings[].',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_voucher_type_dto_1.SaveVoucherTypeDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('inactivate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Make a child type inactive (C4: a used type cannot be deleted).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_type_query_dto_1.VoucherTypeRefDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "inactivate", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete an unused child type (VT_IN_USE when a bill, counter or voucher uses it).',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_type_query_dto_1.VoucherTypeRefDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('print-design-clone'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Alt+C: copy a print design (purpose) as this company’s own, same kind / copies / labels, no layout.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_type_query_dto_1.PrintDesignCloneDto]),
    __metadata("design:returntype", Promise)
], VoucherTypesController.prototype, "clonePrintDesign", null);
exports.VoucherTypesController = VoucherTypesController = __decorate([
    (0, swagger_1.ApiTags)('Voucher Types'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('voucher-types'),
    (0, common_1.UseFilters)(voucher_types_exception_filter_1.VoucherTypesExceptionFilter),
    __metadata("design:paramtypes", [voucher_types_service_1.VoucherTypesService])
], VoucherTypesController);
//# sourceMappingURL=voucher-types.controller.js.map