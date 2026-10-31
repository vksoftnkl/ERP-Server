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
exports.TenderSettlementController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const tender_settlement_dto_1 = require("./dto/tender-settlement.dto");
const tender_settlement_exception_filter_1 = require("./tender-settlement-exception.filter");
const tender_settlement_exceptions_service_1 = require("./tender-settlement-exceptions.service");
const tender_settlement_service_1 = require("./tender-settlement.service");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
let TenderSettlementController = class TenderSettlementController {
    settlement;
    exceptions;
    prisma;
    requestContext;
    constructor(settlement, exceptions, prisma, requestContext) {
        this.settlement = settlement;
        this.exceptions = exceptions;
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async getFormat(query) {
        await this.requireRight('view', 'read a statement format');
        const data = await this.settlement.getFormat(query.companyId, query.tenderId);
        return {
            success: true,
            message: data.format ? 'Statement format' : 'No statement format yet',
            data,
        };
    }
    async saveFormat(dto) {
        await this.requireRight('edit', 'set a statement format');
        const data = await this.settlement.saveFormat(dto);
        return {
            success: true,
            message: data.format ? 'Statement format saved' : 'Statement format cleared',
            data,
        };
    }
    async testFormat(dto, file) {
        await this.requireRight('view', 'test a statement format');
        const data = await this.settlement.testFormat(dto.companyId, dto.tenderId, file);
        return {
            success: true,
            message: `${data.lines.length} line(s) read, ${data.problems.length} problem(s)`,
            data,
        };
    }
    async import(dto, file) {
        await this.requireRight('create', 'import a settlement statement');
        const data = await this.settlement.import(dto, file);
        return { success: true, message: `${data.imports.length} payout(s) imported`, data };
    }
    async get(query) {
        await this.requireRight('view', 'view a settlement');
        const data = await this.settlement.get(query);
        return { success: true, message: `Payout is ${data.status}`, data };
    }
    async match(dto) {
        await this.requireRight('edit', 'match a settlement');
        const data = await this.settlement.match(dto);
        return { success: true, message: `Payout is ${data.status}`, data };
    }
    async confirm(dto) {
        await this.requireRight('edit', 'confirm a settlement line');
        const data = await this.settlement.confirm(dto);
        return { success: true, message: 'Line matched', data };
    }
    async unlink(dto) {
        await this.requireRight('edit', 'unlink a settlement line');
        const data = await this.settlement.unlink(dto);
        return { success: true, message: 'Line unlinked', data };
    }
    async ignore(dto) {
        await this.requireRight('edit', 'ignore a settlement line');
        const data = await this.settlement.ignore(dto);
        return { success: true, message: 'Line ignored', data };
    }
    async post(dto) {
        await this.requireRight('post', 'post a settlement');
        const data = await this.settlement.post(dto);
        return {
            success: true,
            message: `Payout posted (${data.voucherRefno ?? data.voucherId})`,
            data,
        };
    }
    async void(dto) {
        await this.requireRight('cancel', 'void a settlement');
        const data = await this.settlement.void(dto);
        return { success: true, message: 'Payout voided', data };
    }
    async resolve(dto) {
        await this.requireRight('view', 'resolve a settlement line');
        const data = await this.exceptions.resolve(dto);
        return { success: true, message: `Line resolved ${dto.resolution}`, data };
    }
    async writeOff(dto) {
        await this.requireRight('view', 'write off a tender row');
        const data = await this.exceptions.writeOff(dto);
        return { success: true, message: `Written off (${dto.treatment})`, data };
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: tender_settlement_enum_1.SETTLEMENT_MENU_ID,
            right,
            codePrefix: tender_settlement_enum_1.SETTLEMENT_RIGHT_PREFIX,
            action,
        });
    }
};
exports.TenderSettlementController = TenderSettlementController;
__decorate([
    (0, common_1.Get)('format'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A tender’s statement column map (tnd_statement_format) — menu 278 VIEW',
    }),
    (0, swagger_1.ApiOkResponse)({
        description: 'The tender, its terminal / VPA, its settlement ledger and its map',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.SettlementFormatQueryDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "getFormat", null);
__decorate([
    (0, common_1.Post)('format'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Set (or clear) a tender’s statement column map — menu 278 EDIT',
        description: 'Validated in full: every problem comes back at once (SETTLEMENT_FORMAT_INVALID).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The tender and its map' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.SaveSettlementFormatDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "saveFormat", null);
__decorate([
    (0, common_1.Post)('format/test'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: tender_settlement_dto_1.TestSettlementFormatDto }),
    (0, swagger_1.ApiOperation)({
        summary: 'What the saved map reads out of a sample file — nothing is written. Menu 278 VIEW',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ lines (200 at most), problems, payouts }' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.TestSettlementFormatDto, Object]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "testFormat", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: tender_settlement_dto_1.ImportSettlementDto }),
    (0, swagger_1.ApiOperation)({
        summary: 'Import a provider statement: one import per payout, matched at once — menu 278 CREATE',
        description: 'Read with the tender’s column map; each line’s tender from its terminal id / VPA. Refused whole: ' +
            'a row that does not read (SETTLEMENT_FILE_INVALID, every row listed), another store’s terminal ' +
            '(SETTLEMENT_OTHER_STORE), an unknown terminal, the same file twice (SETTLEMENT_FILE_DUPLICATE). ' +
            'Then matched: REF, AUTH → MATCHED; AMOUNT_TIME → SUGGESTED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The imports, with their lines and what each matched' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.ImportSettlementDto, Object]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "import", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One payout: its totals, its lines and the tender row each points at — menu 278 VIEW',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The import' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.SettlementKeyDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('match'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Re-run matching on the lines still waiting (idempotent) — menu 278 EDIT',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The import' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.SettlementKeyDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "match", null);
__decorate([
    (0, common_1.Post)('confirm'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Accept a SUGGESTED match, or link a line to a tender row by hand (MANUAL) — menu 278 EDIT',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The import' }),
    (0, swagger_1.ApiConflictResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'SETTLEMENT_TD_ALREADY_MATCHED · SETTLEMENT_STATE',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.ConfirmSettlementLineDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('unlink'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'A matched, suggested or ignored line back to UNMATCHED — menu 278 EDIT',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The import' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.SettlementLineKeyDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "unlink", null);
__decorate([
    (0, common_1.Post)('ignore'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'A line that is not part of this payout — out of its totals and its voucher. Menu 278 EDIT',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The import' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.IgnoreSettlementLineDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "ignore", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the payout: one TSet, the matched rows SETTLED — menu 278 POST',
        description: 'Dr bank net · Dr bank charges fee · Dr GST on charges (pending) · Dr / Cr Tender suspense · Cr each ' +
            'matched row’s ledger. No approval: it records what the bank did. Refused while a suggestion waits ' +
            '(SETTLEMENT_SUGGESTIONS_OPEN).',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The posted import and its legs' }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.SettlementKeyDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('void'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Void a payout: a posted one’s TSet reversed and its rows PENDING again — menu 278 CANCEL',
        description: 'Refused once a line was resolved or a row written off since (SETTLEMENT_POSTED_LOCKED).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The voided import' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.VoidSettlementDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "void", null);
__decorate([
    (0, common_1.Post)('resolve'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Decide a statement line no bill explains: LINKED · REFUNDED · INCOME · SUSPENSE — menu 278 OVERRIDE',
        description: 'LINKED and INCOME post a TSet journal Dr Tender suspense / Cr the row’s ledger or the income ledger. ' +
            'OVERRIDE stands in for the SETTLEMENT_RESOLVE approval (403 SETTLEMENT_RESOLVE_NEEDS_APPROVAL).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The line, and the journal when one was posted' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.ResolveSettlementLineDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "resolve", null);
__decorate([
    (0, common_1.Post)('write-off'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Write off a card / UPI amount that never arrived, or was charged back — menu 278 OVERRIDE',
        description: 'RECOVER (a named ledger) · SUSPENSE (still chasing) · LOSS (WRITE_OFF role). A TVar Dr that ledger / Cr ' +
            'the row’s own ledger (Tender suspense for a charged-back row); the row FAILED; NONCASH_WRITTEN_OFF on the ' +
            'row’s own session. OVERRIDE stands in for the NONCASH_WRITE_OFF approval (403 NONCASH_WRITE_OFF_NEEDS_APPROVAL).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'What was written off, where' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_settlement_dto_1.WriteOffTenderDto]),
    __metadata("design:returntype", Promise)
], TenderSettlementController.prototype, "writeOff", null);
exports.TenderSettlementController = TenderSettlementController = __decorate([
    (0, swagger_1.ApiTags)('Tender Settlement'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'TSET_RIGHT_<VERB> on menu 278' }),
    (0, common_1.UseFilters)(tender_settlement_exception_filter_1.TenderSettlementExceptionFilter),
    (0, common_1.Controller)('tender-settlement'),
    __metadata("design:paramtypes", [tender_settlement_service_1.TenderSettlementService,
        tender_settlement_exceptions_service_1.TenderSettlementExceptionService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], TenderSettlementController);
//# sourceMappingURL=tender-settlement.controller.js.map