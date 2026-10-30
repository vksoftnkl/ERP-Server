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
exports.TillReviewController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const till_context_service_1 = require("./till-context.service");
const till_exception_filter_1 = require("./till-exception.filter");
const till_review_service_1 = require("./services/till-review.service");
const till_review_dto_1 = require("./dto/till-review.dto");
const till_response_dto_1 = require("./dto/till-response.dto");
const till_enum_1 = require("./types/till-enum");
let TillReviewController = class TillReviewController {
    context;
    reviews;
    constructor(context, reviews) {
        this.context = context;
        this.reviews = reviews;
    }
    async create(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.CASH_POSITION, 'create', 'add a head office review');
        const data = await this.reviews.create({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            dayId: dto.dayId ?? null,
            sessionId: dto.sessionId ?? null,
            outcome: dto.outcome,
            note: dto.note ?? null,
            refVoucherId: dto.refVoucherId ?? null,
            refVoucherAccYear: dto.refVoucherAccYear ?? null,
        });
        return {
            success: true,
            message: `${data.review.outcome} review of ${data.review.sessionNo ?? data.review.businessDate} recorded`,
            data,
        };
    }
    async list(query) {
        await this.context.requireRight(till_enum_1.TILL_MENU.CASH_POSITION, 'view', 'see the head office reviews');
        const data = await this.reviews.list({
            companyId: query.companyId,
            branchId: query.branchId,
            dayId: query.dayId ?? null,
            sessionId: query.sessionId ?? null,
        });
        return { success: true, message: `${data.reviews.length} review(s)`, data };
    }
};
exports.TillReviewController = TillReviewController;
__decorate([
    (0, common_1.Post)('reviews/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Head office reviews a day or a session (notes 134 §2.1)',
        description: 'Inserts an accounts.till_session_review row: the caller is the reviewer, now the time. Exactly one of ' +
            '`dayId` / `sessionId`, a day / session of this company and branch in `accYear` (404 TILL_DAY_NOT_FOUND / ' +
            'TILL_SESSION_NOT_FOUND otherwise). `note` is required unless the outcome is OK. `refVoucherId` + ' +
            '`refVoucherAccYear` name the journal head office raised, on WRITTEN_OFF / SUSPENSE_CLEARED only: a posted ' +
            'voucher of the company. Never edited: a later review of the same day / session supersedes it (`supersedes` ' +
            'names the one it replaced; the newest is `current`). Journalled HO_REVIEW with the outcome. Cash Position ' +
            '(289) CREATE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'VALIDATION_* · TILL_REVIEW_TARGET · TILL_NOTE_REQUIRED · TILL_REVIEW_REF_PAIR · TILL_REVIEW_REF_NOT_ALLOWED',
    }),
    (0, swagger_1.ApiNotFoundResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_DAY_NOT_FOUND · TILL_SESSION_NOT_FOUND · TILL_REVIEW_REF_NOT_FOUND',
    }),
    (0, swagger_1.ApiConflictResponse)({ type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_REVIEW_REF_NOT_POSTED' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_review_dto_1.CreateTillReviewDto]),
    __metadata("design:returntype", Promise)
], TillReviewController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('reviews/list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A branch’s head office reviews, newest first (notes 134 §2.2)',
        description: 'Every review of the branch, or of one day (`dayId`) or one session (`sessionId`). `current` marks the ' +
            'newest of each day / session. Cash Position (289) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_review_dto_1.TillReviewListQueryDto]),
    __metadata("design:returntype", Promise)
], TillReviewController.prototype, "list", null);
exports.TillReviewController = TillReviewController = __decorate([
    (0, swagger_1.ApiTags)('Till'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_RIGHT_VIEW · TILL_RIGHT_CREATE',
    }),
    (0, common_1.Controller)('till'),
    (0, common_1.UseFilters)(till_exception_filter_1.TillExceptionFilter),
    __metadata("design:paramtypes", [till_context_service_1.TillContextService,
        till_review_service_1.TillReviewService])
], TillReviewController);
//# sourceMappingURL=till-review.controller.js.map