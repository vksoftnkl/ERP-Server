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
exports.MobileReturnController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const data_change_service_1 = require("../../common/data-changes/data-change.service");
const error_wording_1 = require("../../common/error-wording/error-wording");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_return_dto_1 = require("./dto/mobile-return.dto");
const mobile_return_response_dto_1 = require("./dto/mobile-return-response.dto");
const mobile_return_exception_filter_1 = require("./mobile-return-exception.filter");
const mobile_return_service_1 = require("./mobile-return.service");
const mobile_return_status_service_1 = require("./mobile-return-status.service");
const CREATE_MESSAGES = {
    POSTED: 'Return created and posted successfully',
    HELD: 'Return saved; it waits for the office',
    SENT_BACK: 'Return saved; it was sent back to fix',
};
let MobileReturnController = class MobileReturnController {
    mobileReturnService;
    mobileReturnStatusService;
    dataChangeService;
    constructor(mobileReturnService, mobileReturnStatusService, dataChangeService) {
        this.mobileReturnService = mobileReturnService;
        this.mobileReturnStatusService = mobileReturnStatusService;
        this.dataChangeService = dataChangeService;
    }
    async options(query) {
        const data = await this.mobileReturnService.options(query);
        return { success: true, message: 'Return options fetched successfully', data };
    }
    async billLines(query) {
        const data = await this.mobileReturnService.billLines(query);
        return { success: true, message: 'Bill lines fetched successfully', data };
    }
    async status(query) {
        const data = await this.mobileReturnStatusService.status(query);
        return { success: true, message: 'Return status fetched successfully', data };
    }
    async create(dto, request) {
        const created = await this.mobileReturnService.create(dto);
        const data = withNoteWording(created, (0, error_wording_1.wordingLangOf)(request));
        if (!data.duplicate) {
            this.publish(request);
        }
        return {
            success: true,
            message: data.duplicate ? 'Return already saved' : CREATE_MESSAGES[data.status],
            data,
        };
    }
    async remove(dto, request) {
        const data = await this.mobileReturnService.delete(dto);
        if (data.deleted && !data.duplicate) {
            this.publish(request);
        }
        return {
            success: true,
            message: data.deleted ? 'Return deleted' : 'No such return',
            data,
        };
    }
    publish(request) {
        this.dataChangeService.publish({
            resource: 'sale-returns',
            method: 'POST',
            at: Date.now(),
            originSessionId: request.user?.sid ?? null,
        });
    }
};
exports.MobileReturnController = MobileReturnController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiSecurity)({}),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: "What a phone return needs: the branch, reasons, godowns, settings and the login's rights",
        description: 'The branch: branchId (the Switch company pick; 422 MOBILE_BRANCH_NOT_OF_COMPANY) or, without ' +
            'it, the device rule (422 MOBILE_BRANCH_NOT_RESOLVED). reasons: the SALE_RETURN reasons the ' +
            "company sees (shared + its own, its own winning by code), as the desktop's dropdown 78; " +
            'isClaim = code ends in _SHOP (hide them, D8). godowns: the live, active godowns of the ' +
            'branch, the default first. settings: returnWindowDays, freeReturnAllowed, settleDefault, ' +
            'expiredLotDays, billDays (returnWindowDays when above 0, else 90). rights: menu 13 create / ' +
            'post of the login, null without a token.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_return_response_dto_1.MobileReturnOptionsSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_DEVICE_*' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'MOBILE_BRANCH_NOT_RESOLVED, MOBILE_BRANCH_NOT_OF_COMPANY',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_return_dto_1.MobileReturnOptionsQueryDto]),
    __metadata("design:returntype", Promise)
], MobileReturnController.prototype, "options", null);
__decorate([
    (0, common_1.Get)('bill-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Posted bills of the branch over a date window, every customer, paged by bill, with what is left to return',
        description: 'Bills: POSTED, live, of the branch (branchId or the device rule), dated since or later ' +
            '(default today less billDays), of every customer of the company, newest first. Each line ' +
            'carries the desktop /sale-returns/bill-lines figures (the same reader): billQtyBase, ' +
            'returnedQtyBase (POSTED returns), qtyLeftBase, onOtherDraftsBase (DRAFT returns, INFO), plus ' +
            'ratePreTaxBase = taxable per base unit after every discount (4 decimals). Needs a token.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_return_response_dto_1.MobileReturnBillLinesSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_DEVICE_*' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_BRANCH_*' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_return_dto_1.MobileReturnBillLinesQueryDto]),
    __metadata("design:returntype", Promise)
], MobileReturnController.prototype, "billLines", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: "What became of this phone's returns: posted, approved, cancelled, deleted",
        description: 'The returns uploaded from this phone (deviceUid; sr_device_id = its dev_id, with a client ' +
            'uuid) in companyId, changed at or after `since` (omitted: all), oldest change first, paged. ' +
            'status DRAFT · POSTED · CANCELLED · DELETED (a draft deleted in the office or by the phone); ' +
            'approval: the latest request not withdrawn (PENDING · APPROVED · REJECTED, an expired one ' +
            'reads REJECTED). asOf = this read less five minutes: send it back as since. Needs a token.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_return_response_dto_1.MobileReturnStatusSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_DEVICE_*' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_return_dto_1.MobileReturnStatusQueryDto]),
    __metadata("design:returntype", Promise)
], MobileReturnController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_return_exception_filter_1.MobileReturnExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload one sale return: saved, then posted at once; POSTED, HELD or SENT_BACK (safe to resend)',
        description: 'The server fills the device (403 MOBILE_DEVICE_*), the branch (422 MOBILE_BRANCH_*), the acc ' +
            "year (422 MOBILE_NO_FISCAL_YEAR), the login as the user, the counter (the phone's dev_id), " +
            "kind RETURN, the salesmen (the bill's; no bill: the login's employee of this company), " +
            "each line's godown (godownId for all, else the bill line's, else the branch default; 422 " +
            'MOBILE_GODOWN_INVALID) and all the money (D45; no money key is taken). 422 ' +
            'MOBILE_RETURN_CUSTOMER_NOT_FOUND, MOBILE_RETURN_REASON_INVALID, SALES_RETURN_BILL_NOT_POSTED, ' +
            'MOBILE_RETURN_BILL_OTHER_CUSTOMER. The menu-13 CREATE / EDIT right is not needed. Then the ' +
            'post (the menu-13 Post right) behind a savepoint: stale Adjust rows are re-planned (replanned[]). ' +
            'A refused post keeps the DRAFT: HELD (held: TILL_APPROVAL_REQUIRED, whose request is filed ' +
            'for the office inbox; SALES_RETURN_WINDOW, GST_CREDIT_NOTE_CUTOFF, SALES_RETURN_LOT_EXPIRED, ' +
            'SALES_RETURN_NO_PRICE, SALES_RETURN_SCHEME_SHORT; SALES_RIGHT_POST; TILL_SESSION_*) or ' +
            'SENT_BACK (refusal: every other code). The same srClientUuid again: POSTED / CANCELLED is ' +
            'answered as it stands (duplicate: true); a DRAFT is saved again with this body and posted ' +
            'again (a DRAFT waiting on an approval is not re-saved, only posted again); another customer ' +
            'is 409 MOBILE_CLIENT_UUID_REUSED; a return the office deleted is 409 MOBILE_RETURN_DELETED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: mobile_return_response_dto_1.MobileReturnCreateSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_return_dto_1.CreateMobileReturnDto, Object]),
    __metadata("design:returntype", Promise)
], MobileReturnController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_return_exception_filter_1.MobileReturnExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete a DRAFT return this phone sent (HELD or SENT_BACK)',
        description: "Through the desktop delete (menu-13 DELETE right); the return's own PENDING approval request " +
            'is withdrawn first. POSTED: 409 SALES_DOC_POSTED (the office cancels it); CANCELLED: 409 ' +
            'SALES_DOC_CANCELLED. A uuid VK Nex never saw: deleted false. Deleted before: deleted true, ' +
            'duplicate true.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: mobile_return_response_dto_1.MobileReturnDeleteSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'MOBILE_DEVICE_*, SALES_RIGHT_DELETE',
    }),
    (0, swagger_1.ApiConflictResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'SALES_DOC_POSTED, SALES_DOC_CANCELLED',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_return_dto_1.DeleteMobileReturnDto, Object]),
    __metadata("design:returntype", Promise)
], MobileReturnController.prototype, "remove", null);
exports.MobileReturnController = MobileReturnController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Returns'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('mobile/returns'),
    __metadata("design:paramtypes", [mobile_return_service_1.MobileReturnService,
        mobile_return_status_service_1.MobileReturnStatusService,
        data_change_service_1.DataChangeService])
], MobileReturnController);
function withNoteWording(data, lang) {
    const word = (note) => {
        if (!note) {
            return null;
        }
        const user = (0, error_wording_1.wordingFor)({ ...note }, lang);
        return user ? { ...note, user } : note;
    };
    return { ...data, held: word(data.held), refusal: word(data.refusal) };
}
//# sourceMappingURL=mobile-return.controller.js.map