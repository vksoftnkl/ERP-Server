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
exports.ChequeBooksController = exports.IssuedChequesController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const voucher_response_dto_1 = require("../vouchers/dto/voucher-response.dto");
const issued_cheques_exception_filter_1 = require("./issued-cheques-exception.filter");
const issued_cheques_service_1 = require("./issued-cheques.service");
const cheque_books_service_1 = require("./cheque-books.service");
const issued_cheques_dto_1 = require("./dto/issued-cheques.dto");
class IssuedSuccessDto {
    success;
    message;
    data;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], IssuedSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], IssuedSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], IssuedSuccessDto.prototype, "data", void 0);
let IssuedChequesController = class IssuedChequesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async get(q) {
        const data = await this.service.get(q);
        return { success: true, message: `Cheque ${data.leaf} — ${data.status}`, data };
    }
    async history(q) {
        const data = await this.service.history(q);
        return { success: true, message: `${data.entries.length} step(s) after issue`, data };
    }
    async presented(dto) {
        const data = await this.service.presented(dto);
        return { success: true, message: `Cheque ${data.leaf} presented on ${data.presentedOn}`, data };
    }
    async returned(dto) {
        const data = await this.service.returned(dto);
        return { success: true, message: `Cheque ${data.leaf} returned — ${data.reversalRefno}`, data };
    }
    async stop(dto) {
        const data = await this.service.stop(dto);
        return { success: true, message: `Cheque ${data.leaf} stopped — ${data.reversalRefno}`, data };
    }
    async void(dto) {
        const data = await this.service.void(dto);
        return { success: true, message: `Cheque ${data.leaf} voided — ${data.reversalRefno}`, data };
    }
    async replace(dto) {
        const data = await this.service.replace(dto);
        return {
            success: true,
            message: `Cheque ${data.replaced.leaf} replaced by ${data.replacement.leaf} on ${data.replacement.voucherRefno}`,
            data,
        };
    }
};
exports.IssuedChequesController = IssuedChequesController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One issued cheque',
        description: 'The leaf, book, bank, supplier, favouring, A/c payee, status, the voucher behind it with its ' +
            'TYPE code (`typeCode`, PmtV), the reversal voucher once returned / stopped / voided, and the ' +
            'replacement link either way.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.IssuedChequeKeysDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({ summary: 'An issued cheque’s trail: issued, then every step (txn_status_log)' }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.IssuedChequeKeysDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "history", null);
__decorate([
    (0, common_1.Post)('presented'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'The bank paid it: HELD → CLEARED',
        description: 'No voucher: the cheque was posted (DR supplier / CR bank) when it was written. Right: post.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.PresentedChequeDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "presented", null);
__decorate([
    (0, common_1.Post)('returned'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Our bank dishonoured it: HELD → BOUNCED, its line reversed',
        description: 'A ChqBnc voucher against the payment: DR bank (the cheque) + DR TDS Payable (the line’s ' +
            'deduction, if any) / CR supplier (the gross the line discharged). Only THIS cheque’s line of ' +
            'a multi-party voucher comes back; its bill allocations are reversed and the bills reopen. ' +
            '`charges` = the bank’s fee: DR BANK_CHARGES / CR bank. The leaf stays used. Right: cancel.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.ReverseChequeDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "returned", null);
__decorate([
    (0, common_1.Post)('stop'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Stop payment: HELD → CANCELLED (STOPPED), its line reversed',
        description: 'As /returned, filed as a stop. `charges` = the stop-payment fee. Right: cancel.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.ReverseChequeDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)('void'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'It never left the office: HELD → CANCELLED (VOIDED), its line reversed',
        description: 'A spoilt or wrongly written cheque. The leaf stays used (the book never hands it out again); ' +
            'no bank charge. Right: cancel.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.VoidChequeDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "void", null);
__decorate([
    (0, common_1.Post)('replace'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'A new cheque for the same payment: a new leaf, a new Payment Voucher',
        description: 'From HELD the old cheque is stopped first (its line reversed). From BOUNCED / CANCELLED it ' +
            'already was. A NEW PmtV is raised for the supplier — the old cheque’s amount, the old line’s ' +
            'TDS treatment, the bills it had settled — taking the next leaf of `chequeBookId`. The old row ' +
            'goes REPLACED, pointing at the new one. Rights: amend on menu 52, post on 261.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.ReplaceChequeDto]),
    __metadata("design:returntype", Promise)
], IssuedChequesController.prototype, "replace", null);
exports.IssuedChequesController = IssuedChequesController = __decorate([
    (0, swagger_1.ApiTags)('Issued Cheques'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, common_1.Controller)('issued-cheques'),
    (0, common_1.UseFilters)(issued_cheques_exception_filter_1.IssuedChequesExceptionFilter),
    __metadata("design:paramtypes", [issued_cheques_service_1.IssuedChequesService])
], IssuedChequesController);
let ChequeBooksController = class ChequeBooksController {
    service;
    constructor(service) {
        this.service = service;
    }
    async get(q) {
        const data = await this.service.get(q);
        return { success: true, message: `Book ${data.bookNo} — ${data.left} leaf(s) left`, data };
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return { success: true, message: `Book ${data.bookNo} saved`, data };
    }
    async close(dto) {
        const data = await this.service.close(dto);
        return { success: true, message: `Book ${data.bookNo} closed`, data };
    }
};
exports.ChequeBooksController = ChequeBooksController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One cheque book, with every leaf it has handed out and where it went',
        description: 'Right: view on menu 263 (Cheque Books).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.ChequeBookKeysDto]),
    __metadata("design:returntype", Promise)
], ChequeBooksController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Open a book, or edit one (upsert on chequeBookId)',
        description: 'A bank account (Bank Accounts / Bank OD) and a leaf range. Two live books on one bank may not ' +
            'share a leaf (VCH_BOOK_OVERLAP). Once a leaf is out, the bank and first leaf are fixed and the ' +
            'last leaf may not drop below the leaves used. Rights: create / edit on menu 263 (Cheque Books).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.SaveChequeBookDto]),
    __metadata("design:returntype", Promise)
], ChequeBooksController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('close'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Put a book away: no more leaves are handed out from it',
        description: 'The leaves already used stay as they are. Right: edit on menu 263 (Cheque Books).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: IssuedSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issued_cheques_dto_1.CloseChequeBookDto]),
    __metadata("design:returntype", Promise)
], ChequeBooksController.prototype, "close", null);
exports.ChequeBooksController = ChequeBooksController = __decorate([
    (0, swagger_1.ApiTags)('Cheque Books'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, common_1.Controller)('cheque-books'),
    (0, common_1.UseFilters)(issued_cheques_exception_filter_1.IssuedChequesExceptionFilter),
    __metadata("design:paramtypes", [cheque_books_service_1.ChequeBooksService])
], ChequeBooksController);
//# sourceMappingURL=issued-cheques.controller.js.map