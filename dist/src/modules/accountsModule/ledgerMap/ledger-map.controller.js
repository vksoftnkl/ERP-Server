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
exports.LedgerMapController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const ledger_map_response_dto_1 = require("./dto/ledger-map-response.dto");
const save_ledger_map_dto_1 = require("./dto/save-ledger-map.dto");
const ledger_map_exception_filter_1 = require("./ledger-map-exception.filter");
const ledger_map_service_1 = require("./ledger-map.service");
let LedgerMapController = class LedgerMapController {
    ledgerMapService;
    constructor(ledgerMapService) {
        this.ledgerMapService = ledgerMapService;
    }
    async listRoles() {
        const data = await this.ledgerMapService.listRoles();
        return {
            success: true,
            message: 'Posting roles fetched successfully',
            data,
        };
    }
    async save(saveLedgerMapDto) {
        const data = await this.ledgerMapService.save(saveLedgerMapDto);
        return {
            success: true,
            message: saveLedgerMapDto.almId
                ? 'Posting ledger mapping updated successfully'
                : 'Posting ledger mapped successfully',
            data,
        };
    }
    async remove(query) {
        const data = await this.ledgerMapService.softDelete(query.almId);
        return {
            success: true,
            message: 'Posting ledger mapping removed successfully',
            data,
        };
    }
};
exports.LedgerMapController = LedgerMapController;
__decorate([
    (0, common_1.Get)('roles'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Every posting role, with the ledger it resolves to — or with nothing',
        description: 'The server owns this list, not the client. A role with no mapping comes back with ' +
            'ledgerId null, which is the case the setup screen exists to show; expectedLedgerType is ' +
            'the filter the ledger picker should apply, and usedBy names the documents that post it.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: ledger_map_response_dto_1.LedgerMapRolesSuccessDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LedgerMapController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Map a role to a ledger, or re-point an existing mapping (by almId presence)',
        description: 'Refuses a role the catalogue does not know, a ledger that does not exist, a deleted or ' +
            'inactive ledger, a ledger of the wrong type for the role, and a second mapping for a role ' +
            'that already has one. almCompanyId / almBranchId / almSupplyNature are not accepted.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: ledger_map_response_dto_1.LedgerMapSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_map_response_dto_1.LedgerMapErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: ledger_map_response_dto_1.LedgerMapErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_map_response_dto_1.LedgerMapErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ledger_map_dto_1.SaveLedgerMapDto]),
    __metadata("design:returntype", Promise)
], LedgerMapController.prototype, "save", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Remove a mapping — refused while a deployed engine still posts that role',
        description: 'Soft delete. An unmapped role is not a blank screen, it is a posting that fails at the ' +
            'moment money is being taken, so a role any document resolves is refused with those ' +
            'documents named. A role nothing posts yet may be unmapped freely.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: ledger_map_response_dto_1.LedgerMapSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_map_response_dto_1.LedgerMapErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: ledger_map_response_dto_1.LedgerMapErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_map_response_dto_1.LedgerMapErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ledger_map_dto_1.DeleteLedgerMapQueryDto]),
    __metadata("design:returntype", Promise)
], LedgerMapController.prototype, "remove", null);
exports.LedgerMapController = LedgerMapController = __decorate([
    (0, swagger_1.ApiTags)('Posting Ledger Map'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('ledger-map'),
    (0, common_1.UseFilters)(ledger_map_exception_filter_1.LedgerMapExceptionFilter),
    __metadata("design:paramtypes", [ledger_map_service_1.LedgerMapService])
], LedgerMapController);
//# sourceMappingURL=ledger-map.controller.js.map