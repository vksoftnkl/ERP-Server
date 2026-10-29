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
exports.TillApprovalController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const till_context_service_1 = require("./till-context.service");
const till_exception_filter_1 = require("./till-exception.filter");
const till_approval_gate_service_1 = require("./services/till-approval-gate.service");
const till_approval_dto_1 = require("./dto/till-approval.dto");
const till_session_dto_1 = require("./dto/till-session.dto");
const till_response_dto_1 = require("./dto/till-response.dto");
const till_enum_1 = require("./types/till-enum");
let TillApprovalController = class TillApprovalController {
    context;
    gate;
    constructor(context, gate) {
        this.context = context;
        this.gate = gate;
    }
    async request(dto) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.OPEN_TILL, 'view'],
            [till_enum_1.TILL_MENU.SESSIONS, 'view'],
        ], 'ask for a till approval');
        const data = await this.gate.request(dto);
        return {
            success: true,
            message: data.status === 'APPROVED'
                ? `${data.event} approved by ${data.decidedByName ?? 'the approver'}`
                : `${data.event} waits for an approver (${data.requiredRole} or above)`,
            data,
        };
    }
    async decide(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'override', 'decide a till approval');
        const data = await this.gate.decide(dto);
        return { success: true, message: `${data.event} ${data.status.toLowerCase()}`, data };
    }
    async cancel(dto) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.OPEN_TILL, 'view'],
            [till_enum_1.TILL_MENU.SESSIONS, 'view'],
        ], 'cancel a till approval');
        const data = await this.gate.cancel(dto);
        return { success: true, message: `${data.event} request cancelled`, data };
    }
    async get(query) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.OPEN_TILL, 'view'],
            [till_enum_1.TILL_MENU.SESSIONS, 'view'],
        ], 'view a till approval');
        const data = await this.gate.get(query);
        return { success: true, message: `${data.event}: ${data.status}`, data };
    }
    async pending(query) {
        await this.context.requireRight(till_enum_1.TILL_MENU.SESSIONS, 'view', 'see the approvals inbox');
        const data = await this.gate.pending(query);
        return {
            success: true,
            message: `${data.items.length} decision(s) waiting`,
            data,
        };
    }
    async requireAny(options, action) {
        for (const [menuId, right] of options) {
            if ((await this.context.rights(menuId))[right]) {
                return;
            }
        }
        const [menuId, right] = options[0];
        await this.context.requireRight(menuId, right, action);
    }
};
exports.TillApprovalController = TillApprovalController;
__decorate([
    (0, common_1.Post)('approvals/request'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Ask for an approval — PENDING for an approver, or decided at once at the counter',
        description: 'A till_approval row for an event (ck_tap_event) and an amount under the event’s rule (a branch row beats a ' +
            'company row beats the shipped one; none = SUPERVISOR, EITHER). The rule as it stands is kept with the ' +
            'request, so a decision is judged by the bar that stood when it was asked. `srcDocType` / `srcDocId` name ' +
            'what it unlocks — what a 428 TILL_APPROVAL_REQUIRED named; the same caller asking again for the same ' +
            'document gets the PENDING request back. `approverId` + `approverPin` (+ `secondId` / `secondPin` on a ' +
            'two-person rule): the approver standing at the counter decides it in this call (COUNTER channel). A rule ' +
            'that asks nothing for the amount → 422 TILL_APPROVAL_INVALID (`needed: false`). `tar_expire_minutes` > 0 ' +
            'gives the request an expiry. APPROVAL_REQUESTED journalled. Open Till (272) VIEW or Till Sessions (273) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_APPROVAL_INVALID · TILL_REASON_INVALID · TILL_APPROVER_NO_PIN',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_approval_dto_1.RequestTillApprovalDto]),
    __metadata("design:returntype", Promise)
], TillApprovalController.prototype, "request", null);
__decorate([
    (0, common_1.Post)('approvals/decide'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Approve or reject a PENDING request — the caller is the approver',
        description: '`assertApprover` against the request’s snapshot rule: not whoever asked (403 TILL_APPROVER_SELF unless the ' +
            'rule or till.single_operator allows it), a 285 grant at the level for the event covering the amount ' +
            '(TILL_APPROVER_NO_GRANT / _LIMIT; a SUPER ADMIN is an implicit HO_FINANCE grant), the channel (COUNTER: ' +
            '`approverPin`; REMOTE: a remote grant — TILL_APPROVER_PIN, a wrong PIN journalled PIN_FAIL). APPROVE on a ' +
            'two-person rule takes `secondId` + `secondPin` (403 TILL_APPROVER_SECOND). Not PENDING → 409 ' +
            'TILL_APPROVAL_NOT_PENDING; past its expiry → 409 TILL_APPROVAL_EXPIRED (swept to EXPIRED). An approved ' +
            'FLOAT_MISMATCH filed at an open is recorded on its variance. APPROVAL_DECIDED journalled. Till Sessions ' +
            '(273) OVERRIDE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_APPROVAL_NOT_PENDING · TILL_APPROVAL_EXPIRED',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_approval_dto_1.DecideTillApprovalDto]),
    __metadata("design:returntype", Promise)
], TillApprovalController.prototype, "decide", null);
__decorate([
    (0, common_1.Post)('approvals/cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Withdraw a PENDING request',
        description: 'Whoever asked; anyone else needs Till Sessions (273) OVERRIDE (403 TILL_APPROVAL_NOT_YOURS). CANCELLED, ' +
            'journalled as APPROVAL_DECIDED with status CANCELLED. Not PENDING → 409 TILL_APPROVAL_NOT_PENDING.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_approval_dto_1.CancelTillApprovalDto]),
    __metadata("design:returntype", Promise)
], TillApprovalController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('approvals/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One approval request: its status, who asked, who decided, whether a document has used it',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_approval_dto_1.TillApprovalKeyDto]),
    __metadata("design:returntype", Promise)
], TillApprovalController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('approvals/pending'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The approvers’ inbox: everything in the branch waiting for a decision, and where to decide it',
        description: 'kind REQUEST (approvals/decide) · SESSION_VARIANCE (sessions/decide-variance: PENDING_APPROVAL, and a ' +
            'CLOSED session whose drawer gap was left undecided — `afterClose`) · RECEIVE_VARIANCE (decide-variance with ' +
            '`tcmId`) · SAFE_VARIANCE (safes/decide-variance). Each with the event, the rule’s level and channel, who ' +
            'asked and when, and `canDecide` / `cannotBecause` for the caller’s own authority (no PIN asked here). A ' +
            'variance’s amount is null without Till Sessions (273) OVERRIDE (the count is blind). Requests past their ' +
            'expiry are swept to EXPIRED first (`expired`). Till Sessions (273) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_session_dto_1.TillScopeDto]),
    __metadata("design:returntype", Promise)
], TillApprovalController.prototype, "pending", null);
exports.TillApprovalController = TillApprovalController = __decorate([
    (0, swagger_1.ApiTags)('Till'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, common_1.Controller)('till'),
    (0, common_1.UseFilters)(till_exception_filter_1.TillExceptionFilter),
    __metadata("design:paramtypes", [till_context_service_1.TillContextService,
        till_approval_gate_service_1.TillApprovalGateService])
], TillApprovalController);
//# sourceMappingURL=till-approval.controller.js.map