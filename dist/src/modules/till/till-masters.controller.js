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
exports.TillMastersController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const till_context_service_1 = require("./till-context.service");
const till_exception_filter_1 = require("./till-exception.filter");
const till_masters_service_1 = require("./services/till-masters.service");
const save_till_masters_dto_1 = require("./dto/save-till-masters.dto");
const till_response_dto_1 = require("./dto/till-response.dto");
const till_enum_1 = require("./types/till-enum");
let TillMastersController = class TillMastersController {
    context;
    masters;
    constructor(context, masters) {
        this.context = context;
        this.masters = masters;
    }
    async saveCounter(dto) {
        await this.requireSave(till_enum_1.TILL_MENU.MASTERS, dto.tcnId, 'till counters');
        const data = await this.masters.saveCounter(dto);
        return {
            success: true,
            message: dto.tcnId ? `Counter ${data.tcnCode} updated` : `Counter ${data.tcnCode} created`,
            data,
        };
    }
    async getCounter(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'view', 'view till counters');
        return {
            success: true,
            message: 'Counter fetched',
            data: await this.masters.getCounter(q.id, q.companyId),
        };
    }
    async deleteCounter(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'delete', 'delete till counters');
        return {
            success: true,
            message: 'Counter deleted',
            data: await this.masters.deleteCounter(q.id, q.companyId),
        };
    }
    async saveSafe(dto) {
        await this.requireSave(till_enum_1.TILL_MENU.MASTERS, dto.tsfId, 'till safes');
        const data = await this.masters.saveSafe(dto);
        return {
            success: true,
            message: dto.tsfId ? `Safe ${data.tsfCode} updated` : `Safe ${data.tsfCode} created`,
            data,
        };
    }
    async getSafe(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'view', 'view till safes');
        return {
            success: true,
            message: 'Safe fetched',
            data: await this.masters.getSafe(q.id, q.companyId),
        };
    }
    async deleteSafe(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'delete', 'delete till safes');
        return {
            success: true,
            message: 'Safe deleted',
            data: await this.masters.deleteSafe(q.id, q.companyId),
        };
    }
    async saveReason(dto) {
        await this.requireSave(till_enum_1.TILL_MENU.MASTERS, dto.trsId, 'till reasons');
        const data = await this.masters.saveReason(dto);
        return { success: true, message: dto.trsId ? 'Reason updated' : 'Reason created', data };
    }
    async getReason(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'view', 'view till reasons');
        return {
            success: true,
            message: 'Reason fetched',
            data: await this.masters.getReason(q.id, q.companyId),
        };
    }
    async deleteReason(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'delete', 'delete till reasons');
        return {
            success: true,
            message: 'Reason deleted',
            data: await this.masters.deleteReason(q.id, q.companyId),
        };
    }
    async saveDenomination(dto) {
        await this.requireSave(till_enum_1.TILL_MENU.MASTERS, dto.tdnId, 'denominations');
        const data = await this.masters.saveDenomination(dto);
        return {
            success: true,
            message: dto.tdnId ? 'Denomination updated' : 'Denomination created',
            data,
        };
    }
    async getDenomination(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'view', 'view denominations');
        return {
            success: true,
            message: 'Denomination fetched',
            data: await this.masters.getDenomination(q.id, q.companyId),
        };
    }
    async listDenominations(q) {
        const till = await this.context.rights(till_enum_1.TILL_MENU.OPEN_TILL);
        if (!till.view) {
            await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'view', 'view denominations');
        }
        const data = await this.masters.listDenominations(q.companyId);
        return { success: true, message: `${data.length} denomination(s)`, data };
    }
    async deleteDenomination(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.MASTERS, 'delete', 'delete denominations');
        return {
            success: true,
            message: 'Denomination deleted',
            data: await this.masters.deleteDenomination(q.id, q.companyId),
        };
    }
    async saveRule(dto) {
        await this.requireSave(till_enum_1.TILL_MENU.APPROVAL_SETUP, dto.tarId, 'till approval rules');
        const data = await this.masters.saveRule(dto);
        return {
            success: true,
            message: dto.tarId ? 'Approval rule updated' : 'Approval rule created',
            data,
        };
    }
    async getRule(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.APPROVAL_SETUP, 'view', 'view till approval rules');
        return {
            success: true,
            message: 'Approval rule fetched',
            data: await this.masters.getRule(q.id, q.companyId),
        };
    }
    async deleteRule(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.APPROVAL_SETUP, 'delete', 'delete till approval rules');
        return {
            success: true,
            message: 'Approval rule deleted',
            data: await this.masters.deleteRule(q.id, q.companyId),
        };
    }
    async saveAuthority(dto) {
        await this.requireSave(till_enum_1.TILL_MENU.APPROVAL_SETUP, dto.taaId, 'till approval authority');
        const data = await this.masters.saveAuthority(dto);
        return {
            success: true,
            message: dto.taaId ? 'Approval authority updated' : 'Approval authority granted',
            data,
        };
    }
    async getAuthority(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.APPROVAL_SETUP, 'view', 'view till approval authority');
        return {
            success: true,
            message: 'Approval authority fetched',
            data: await this.masters.getAuthority(q.id, q.companyId),
        };
    }
    async deleteAuthority(q) {
        await this.context.requireRight(till_enum_1.TILL_MENU.APPROVAL_SETUP, 'delete', 'withdraw till approval authority');
        return {
            success: true,
            message: 'Approval authority withdrawn',
            data: await this.masters.deleteAuthority(q.id, q.companyId),
        };
    }
    async requireSave(menuId, id, what) {
        const right = id ? 'edit' : 'create';
        await this.context.requireRight(menuId, right, `${id ? 'edit' : 'create'} ${what}`);
    }
};
exports.TillMastersController = TillMastersController;
__decorate([
    (0, common_1.Post)('counters/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a counter (by tcnId presence)',
        description: 'Till Masters (275) CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.SaveTillCounterDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "saveCounter", null);
__decorate([
    (0, common_1.Get)('counters/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({ summary: 'One counter', description: 'Till Masters (275) VIEW.' }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "getCounter", null);
__decorate([
    (0, common_1.Delete)('counters/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a counter (refused while a session is live on it)',
        description: 'Till Masters (275) DELETE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "deleteCounter", null);
__decorate([
    (0, common_1.Post)('safes/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a safe (by tsfId presence)',
        description: 'No ledger named on a new safe = the SAFE_CASH role’s ledger. Till Masters (275) CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.SaveTillSafeDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "saveSafe", null);
__decorate([
    (0, common_1.Get)('safes/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({ summary: 'One safe', description: 'Till Masters (275) VIEW.' }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "getSafe", null);
__decorate([
    (0, common_1.Delete)('safes/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a safe (refused while a counter drops into it)',
        description: 'Till Masters (275) DELETE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "deleteSafe", null);
__decorate([
    (0, common_1.Post)('reasons/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a company reason (by trsId presence)',
        description: 'Shipped (shared) reasons are read-only. Till Masters (275) CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.SaveTillReasonDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "saveReason", null);
__decorate([
    (0, common_1.Get)('reasons/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One reason (a company row or a shipped one)',
        description: 'Till Masters (275) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "getReason", null);
__decorate([
    (0, common_1.Delete)('reasons/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a company reason',
        description: 'Till Masters (275) DELETE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "deleteReason", null);
__decorate([
    (0, common_1.Post)('denominations/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a company denomination (by tdnId presence)',
        description: 'Till Masters (275) CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.SaveTillDenominationDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "saveDenomination", null);
__decorate([
    (0, common_1.Get)('denominations/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({ summary: 'One denomination', description: 'Till Masters (275) VIEW.' }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "getDenomination", null);
__decorate([
    (0, common_1.Get)('denominations/list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The notes and coins a count offers this company, in screen order',
        description: 'Its own rows and the shipped ones valid today; a company row replaces the shipped row of the same value. ' +
            'Open Till (272) VIEW or Till Masters (275) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillListSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillDenominationListQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "listDenominations", null);
__decorate([
    (0, common_1.Delete)('denominations/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a company denomination',
        description: 'Till Masters (275) DELETE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "deleteDenomination", null);
__decorate([
    (0, common_1.Post)('approval-rules/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a company / branch approval rule (by tarId presence)',
        description: 'A branch rule beats the company rule, which beats the shipped one. Till Approval Setup (276) CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.SaveTillApprovalRuleDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "saveRule", null);
__decorate([
    (0, common_1.Get)('approval-rules/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({ summary: 'One approval rule', description: 'Till Approval Setup (276) VIEW.' }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "getRule", null);
__decorate([
    (0, common_1.Delete)('approval-rules/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a company / branch approval rule',
        description: 'Till Approval Setup (276) DELETE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "deleteRule", null);
__decorate([
    (0, common_1.Post)('approval-authorities/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Grant or change an approval authority (by taaId presence)',
        description: 'Who may approve which event, at which level, up to how much, and whether remotely. Till Approval Setup (276) CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.SaveTillApprovalAuthorityDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "saveAuthority", null);
__decorate([
    (0, common_1.Get)('approval-authorities/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One approval authority grant',
        description: 'Till Approval Setup (276) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "getAuthority", null);
__decorate([
    (0, common_1.Delete)('approval-authorities/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Withdraw an approval authority grant',
        description: 'Till Approval Setup (276) DELETE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_till_masters_dto_1.TillMasterKeyQueryDto]),
    __metadata("design:returntype", Promise)
], TillMastersController.prototype, "deleteAuthority", null);
exports.TillMastersController = TillMastersController = __decorate([
    (0, swagger_1.ApiTags)('Till Masters'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, common_1.Controller)('till'),
    (0, common_1.UseFilters)(till_exception_filter_1.TillExceptionFilter),
    __metadata("design:paramtypes", [till_context_service_1.TillContextService,
        till_masters_service_1.TillMastersService])
], TillMastersController);
//# sourceMappingURL=till-masters.controller.js.map