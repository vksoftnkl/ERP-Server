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
exports.LoyaltyMembersController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../../common/dto/http-error-response.dto");
const loyalty_member_action_dto_1 = require("./dto/loyalty-member-action.dto");
const loyalty_members_service_1 = require("./loyalty-members.service");
let LoyaltyMembersController = class LoyaltyMembersController {
    service;
    constructor(service) {
        this.service = service;
    }
    async status(dto) {
        const data = await this.service.setStatus(dto);
        return { success: true, message: `Member ${data.toStatus}`, data };
    }
    async adjust(dto) {
        const data = await this.service.adjust(dto);
        return { success: true, message: `${data.rowsWritten} ledger row(s) written`, data };
    }
    async history(q) {
        const data = await this.service.history(q);
        return { success: true, message: `${data.steps.length} step(s)`, data };
    }
};
exports.LoyaltyMembersController = LoyaltyMembersController;
__decorate([
    (0, common_1.Post)('status'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Suspend, reactivate or close a wallet',
        description: 'Writes lmb_status / lmb_block_reason and one txn_status_log step; no ledger row. MERGED is ' +
            'not settable. CLOSED with a balance ≠ 0 is refused (422 LOYALTY_MEMBER_HAS_BALANCE) unless ' +
            '`force` is sent with `approvedBy` — then the wallet is written off first, one ADJUST row ' +
            'per open lot, and `drained` reports it (D6).',
    }),
    (0, swagger_1.ApiBadRequestResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'LOYALTY_MEMBER_REASON_REQUIRED, LOYALTY_MEMBER_APPROVER_REQUIRED',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'LOYALTY_MEMBER_HAS_BALANCE, LOYALTY_MEMBER_NO_CHANGE, LOYALTY_MEMBER_MERGED',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_member_action_dto_1.LoyaltyMemberStatusDto]),
    __metadata("design:returntype", Promise)
], LoyaltyMembersController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('adjust'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Adjust a wallet’s points, with an approver',
        description: 'ONE adjustment document through LoyaltyLedgerService.adjust(). Positive = a lot (never ' +
            'lapses unless expiresOn). Negative = FIFO through the lots like a redeem, refused beyond ' +
            'the redeemable balance (422 SALES_LOYALTY_CAP). approvedBy is required by the DTO — a 400 ' +
            'before the database answers.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'SALES_LOYALTY_CAP' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_member_action_dto_1.LoyaltyMemberAdjustDto]),
    __metadata("design:returntype", Promise)
], LoyaltyMembersController.prototype, "adjust", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Ctrl+H — the member’s status trail',
        description: 'The txn_status_log steps written by /status, oldest first.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_member_action_dto_1.LoyaltyMemberHistoryDto]),
    __metadata("design:returntype", Promise)
], LoyaltyMembersController.prototype, "history", null);
exports.LoyaltyMembersController = LoyaltyMembersController = __decorate([
    (0, swagger_1.ApiTags)('Loyalty — Members'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'LST_RIGHT_EDIT / LST_RIGHT_DELETE / LST_RIGHT_VIEW',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'LOYALTY_MEMBER_NOT_FOUND' }),
    (0, common_1.Controller)('loyalty/members'),
    __metadata("design:paramtypes", [loyalty_members_service_1.LoyaltyMembersService])
], LoyaltyMembersController);
//# sourceMappingURL=loyalty-members.controller.js.map