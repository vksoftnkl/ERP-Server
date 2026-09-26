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
exports.BillController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
const bill_exception_filter_1 = require("./bill-exception.filter");
const bill_service_1 = require("./bill.service");
const bill_lifecycle_service_1 = require("./bill-lifecycle.service");
const bill_read_service_1 = require("./bill-read.service");
const bill_band_service_1 = require("./bill-band.service");
const bill_retender_service_1 = require("./bill-retender.service");
const save_bill_dto_1 = require("./dto/save-bill.dto");
const bill_lifecycle_dto_1 = require("./dto/bill-lifecycle.dto");
const bill_response_dto_1 = require("./dto/bill-response.dto");
let BillController = class BillController {
    billService;
    lifecycle;
    read;
    band;
    retenderService;
    constructor(billService, lifecycle, read, band, retenderService) {
        this.billService = billService;
        this.lifecycle = lifecycle;
        this.read = read;
        this.band = band;
        this.retenderService = retenderService;
    }
    ok(message, data) {
        return { success: true, message, data };
    }
    async save(dto) {
        const data = await this.billService.save(dto);
        return this.ok(dto.sbId ? 'Bill updated successfully' : 'Bill created successfully', data);
    }
    async validate(dto) {
        return this.ok('Bill validated', await this.lifecycle.validate(dto));
    }
    async post(dto) {
        return this.ok('Bill posted successfully', await this.lifecycle.post(dto));
    }
    async cancel(dto) {
        return this.ok('Bill cancelled successfully', await this.lifecycle.cancel(dto));
    }
    async amend(dto) {
        return this.ok('Bill amended successfully', await this.lifecycle.amend(dto));
    }
    async remove(dto) {
        return this.ok('Draft bill deleted successfully', await this.billService.deleteDraft(dto));
    }
    async getById(sbId, sbCompanyId, sbBranchId, sbAccYear) {
        return this.ok('Bill fetched successfully', await this.billService.getById(sbId, sbCompanyId, sbBranchId, sbAccYear));
    }
    async openSources(companyId, branchId, partyId, kind, accYear) {
        const k = (kind ?? '').toUpperCase() === 'ORDER' ? 'ORDER' : 'DC';
        return this.ok('Open sources fetched', await this.read.openSources({
            companyId,
            branchId,
            partyId,
            kind: k,
            accYear: accYear || null,
        }));
    }
    async partyContext(partyId, companyId, branchId, accYear, billDate) {
        return this.ok('Party context fetched', await this.read.partyContext({
            partyId,
            companyId,
            branchId,
            accYear,
            billDate: billDate || null,
        }));
    }
    async deliveryStatus(dto) {
        return this.ok('Delivery status updated', await this.band.deliveryStatus(dto));
    }
    async updateRemarks(dto) {
        return this.ok('Remarks updated', await this.band.updateRemarks(dto));
    }
    async transport(dto) {
        return this.ok('Transport details saved', await this.band.transport(dto));
    }
    async tenderContext(sbId, sbCompanyId, sbBranchId, sbAccYear) {
        return this.ok('Tender context fetched', await this.read.tenderContext({ sbId, sbCompanyId, sbBranchId, sbAccYear }));
    }
    async retender(dto) {
        return this.ok('Bill re-tendered successfully', await this.retenderService.retender(dto));
    }
};
exports.BillController = BillController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a DRAFT bill (by sbId presence)',
        description: 'sbStatus in the body is ignored — a saved bill is a DRAFT until /bills/post. A POSTED sbId ' +
            'answers 409 SALES_BILL_POSTED (use /bills/amend). Ship-to / dispatch / transport fields write ' +
            'the OUTWARD transport band. Answers the /get shape.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_bill_dto_1.SaveBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Dry-run the post: every refusal and warning, plus proposals. Writes nothing.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ ok, refusals[], warnings[], rights, proposals }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.ValidateBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post a DRAFT bill — the one-way door',
        description: 'One transaction: stock, legs, register, receivable, set-offs, temp credits, loyalty, promotions, ' +
            'charge carry, fulfilment, then status. Idempotent on a POSTED id. Refusals answer 422 with every ' +
            'code; a WARN passes only when its code is in overrides[] AND um_can_override.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.PostBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a POSTED bill by reversal (never a delete). Reason mandatory.' }),
    (0, swagger_1.ApiOkResponse)({
        description: '{ ...keys, sbStatus: CANCELLED, reversalVoucherRefno, cancelledOn }',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.CancelBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('amend'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Amend a POSTED bill (R20): unwind, re-apply, re-post, revision + 1',
        description: 'Gated by sales.allow_posted_amend (409 SALES_AMEND_OFF), baseRevision (409 SALES_REVISION_STALE) ' +
            'and lock 2 (409 SALES_IRN_LIVE / SALES_EWB_LIVE — a declared document is cancelled, never amended).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.AmendBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "amend", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a DRAFT bill. A POSTED id answers 409 SALES_BILL_POSTED (use /bills/cancel).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ sbId, deleted: true }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.DeleteBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get bill by id — header, items, charges, tenders, posting, locks, rights, sources',
    }),
    (0, swagger_1.ApiQuery)({ name: 'sbId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbAccYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    __param(0, (0, common_1.Query)('sbId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sbCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sbBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sbAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('open-sources'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Open challan / order lines of a party a bill can take' }),
    (0, swagger_1.ApiQuery)({ name: 'companyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'partyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'kind', schema: { type: 'string', enum: ['DC', 'ORDER'] } }),
    (0, swagger_1.ApiQuery)({ name: 'accYear', required: false, schema: { type: 'string' } }),
    __param(0, (0, common_1.Query)('companyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('branchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('partyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('kind')),
    __param(4, (0, common_1.Query)('accYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "openSources", null);
__decorate([
    (0, common_1.Get)('party-context'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Everything the screen needs on customer pick, in one call' }),
    (0, swagger_1.ApiQuery)({ name: 'partyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'companyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'accYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiQuery)({ name: 'billDate', required: false, schema: { type: 'string', format: 'date' } }),
    __param(0, (0, common_1.Query)('partyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('companyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('branchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('accYear')),
    __param(4, (0, common_1.Query)('billDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "partyContext", null);
__decorate([
    (0, common_1.Put)('delivery-status'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'VERIFIED → PACKED → DISPATCHED → DELIVERED, order enforced (409 SALES_DELIVERY_ORDER)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.DeliveryStatusDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "deliveryStatus", null);
__decorate([
    (0, common_1.Put)('update-remarks'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Edit the remarks of a POSTED bill — text only' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.UpdateRemarksDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "updateRemarks", null);
__decorate([
    (0, common_1.Put)('transport'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The transport band on its own verb — open between POST and declaration, refused after (GST_DECLARED_LOCKED)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.BillTransportDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "transport", null);
__decorate([
    (0, common_1.Get)('tender-context'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: "The re-tender dialog's ONLY read — small, no items, no party context" }),
    (0, swagger_1.ApiQuery)({ name: 'sbId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbAccYear', schema: { type: 'string' } }),
    __param(0, (0, common_1.Query)('sbId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sbCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sbBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sbAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "tenderContext", null);
__decorate([
    (0, common_1.Post)('retender'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Change how it was paid, not what was sold',
        description: 'Voids the rows that did not happen (kept, td_is_voided) and writes what really happened ' +
            '(td_replaces_id). On a POSTED bill posts a TndC contra; the party balance never moves. Needs ' +
            'um_can_retender. Refused when the totals differ, the day is closed, or a PDC has moved.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bill_lifecycle_dto_1.RetenderBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "retender", null);
exports.BillController = BillController = __decorate([
    (0, swagger_1.ApiTags)('Bills'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('bills'),
    (0, common_1.UseFilters)(bill_exception_filter_1.BillExceptionFilter),
    __metadata("design:paramtypes", [bill_service_1.BillService,
        bill_lifecycle_service_1.BillLifecycleService,
        bill_read_service_1.BillReadService,
        bill_band_service_1.BillBandService,
        bill_retender_service_1.BillRetenderService])
], BillController);
//# sourceMappingURL=bill.controller.js.map