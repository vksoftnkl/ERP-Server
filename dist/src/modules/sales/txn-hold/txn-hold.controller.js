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
exports.TxnHoldController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const txn_hold_exception_filter_1 = require("./txn-hold-exception.filter");
const txn_hold_response_dto_1 = require("./dto/txn-hold-response.dto");
const list_txn_hold_query_dto_1 = require("./dto/list-txn-hold-query.dto");
const lock_txn_hold_dto_1 = require("./dto/lock-txn-hold.dto");
const save_txn_hold_dto_1 = require("./dto/save-txn-hold.dto");
const txn_hold_service_1 = require("./txn-hold.service");
const api_version_1 = require("../../../common/constants/api-version");
const DEVICE_ID_HEADER = 'x-device-id';
const DEVICE_ID_HEADER_DOC = {
    name: 'X-Device-Id',
    required: true,
    description: 'fixed.device_master.dev_id — the till taking, holding or spending the lease',
    schema: { type: 'string', format: 'uuid' },
};
const ACC_YEAR_QUERY_DOC = {
    name: 'txhAccYear',
    required: false,
    description: 'Accounting year (YYYY-YYYY) — prunes the lookup to one partition',
    schema: { type: 'string', minLength: 9, maxLength: 9, example: '2026-2027' },
};
let TxnHoldController = class TxnHoldController {
    txnHoldService;
    constructor(txnHoldService) {
        this.txnHoldService = txnHoldService;
    }
    async save(saveTxnHoldDto) {
        const data = await this.txnHoldService.save(saveTxnHoldDto);
        return {
            success: true,
            message: saveTxnHoldDto.txhId ? 'Hold updated successfully' : 'Hold created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.txnHoldService.list(queryDto);
        return {
            success: true,
            message: 'Holds fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(txhId, txhAccYear) {
        const data = await this.txnHoldService.getById(txhId, txhAccYear);
        return {
            success: true,
            message: 'Hold fetched successfully',
            data,
        };
    }
    async resume(txhId, deviceId, lockDto) {
        const data = await this.txnHoldService.resumeHold(txhId, deviceId, lockDto);
        return {
            success: true,
            message: 'Hold resumed successfully',
            data,
        };
    }
    async release(txhId, deviceId, lockDto) {
        const data = await this.txnHoldService.releaseHold(txhId, deviceId, lockDto);
        return {
            success: true,
            message: 'Hold released successfully',
            data,
        };
    }
    async forceRelease(txhId, deviceId, lockDto) {
        const data = await this.txnHoldService.forceReleaseHold(txhId, deviceId, lockDto);
        return {
            success: true,
            message: 'Hold lease released successfully',
            data,
        };
    }
    async convert(txhId, deviceId, convertDto) {
        const data = await this.txnHoldService.convertHold(txhId, deviceId, convertDto, {
            txhConvertedDocId: convertDto.txhConvertedDocId,
            txhConvertedAccYear: convertDto.txhConvertedAccYear,
            txhConvertedRefno: convertDto.txhConvertedRefno,
            txhConvertedBy: convertDto.txhConvertedBy,
        });
        return {
            success: true,
            message: 'Hold converted successfully',
            data,
        };
    }
    async remove(txhId, txhAccYear) {
        const data = await this.txnHoldService.softDelete(txhId, txhAccYear);
        return {
            success: true,
            message: 'Hold deleted successfully',
            data,
        };
    }
};
exports.TxnHoldController = TxnHoldController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update one hold (by txhId presence)',
        description: 'A create needs txhCompanyId, txhBranchId, txhAccYear, txhSrcModule, txhDocType, ' +
            'txhHoldNo, txhHoldSlno, txhDeviceId, txhHeldBy and txhPayload. An update needs txhId ' +
            'plus the fields that change; the company / branch / accounting year scope is immutable ' +
            '(the year is half the primary key), and a hold already CONVERTED, EXPIRED, CANCELLED or ' +
            'ABANDONED cannot be reopened. Posting txhKind=AUTOSAVE OVERWRITES this screen’s live ' +
            'snapshot in place and bumps txhRevision instead of creating a second row. The lease and ' +
            'conversion columns are not writable here — the endpoints below move them as whole blocks.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_txn_hold_dto_1.SaveTxnHoldDto]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List holds with search, filters and pagination',
        description: 'Newest first. Soft-deleted holds are never returned. Pass txhKind=HOLD for the ' +
            'operator-facing pick list — AUTOSAVE snapshots and TEMPLATEs share the table. Sending ' +
            'any filter beyond `search` takes the query off the configured grid and onto the ' +
            'module’s own query.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_txn_hold_query_dto_1.ListTxnHoldQueryDto]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get hold by id' }),
    (0, swagger_1.ApiQuery)({ name: 'txhId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)(ACC_YEAR_QUERY_DOC),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Query)('txhId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Query)('txhAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(':id/resume'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Resume a hold onto this device, taking its lease',
        description: 'HELD → LOCKED, leased to the authenticated operator on the X-Device-Id device until ' +
            'lockTtlSeconds have passed. Answers the whole hold including txhPayload and the fresh ' +
            'txhLockToken, so the till can redraw the screen and prove the lease later. A hold whose ' +
            'lease has ALREADY LAPSED is taken over without a force-release — that is what stops a ' +
            'till that died mid-edit from stranding a cart. A hold under a live lease held by another ' +
            'device answers 409; by the SAME device it answers 200 without a second resume count or a ' +
            'longer lease, so a retried request is harmless. A TEMPLATE is copied, not leased (400).',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' }),
    (0, swagger_1.ApiHeader)(DEVICE_ID_HEADER_DOC),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Headers)(DEVICE_ID_HEADER)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, lock_txn_hold_dto_1.LockTxnHoldDto]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)(':id/release'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Release the lease this device holds, without billing',
        description: 'LOCKED → HELD, so another till can recall the same parked work. Only the device holding ' +
            'the lease may release it (403 otherwise), and when txhLockToken is sent it must be the ' +
            'one resume answered with. A hold that is already HELD answers 200 unchanged. ' +
            'txhResumedBy / txhResumedOn / txhResumeCount are left as the history they are.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' }),
    (0, swagger_1.ApiHeader)(DEVICE_ID_HEADER_DOC),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Headers)(DEVICE_ID_HEADER)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, lock_txn_hold_dto_1.LockTxnHoldDto]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "release", null);
__decorate([
    (0, common_1.Post)(':id/force-release'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Take the lease away from the device holding it',
        description: 'LOCKED → HELD without the ownership check — for the cart the floor needs back before the ' +
            'lease lapses on its own. A separate route from /release on purpose: it interrupts ' +
            'whoever is on the hold, and the audit entry names both devices. It cannot reopen a ' +
            'closed hold (409), and an already-HELD one answers 200 unchanged. RESUMED is cleared ' +
            'too — that is what "in use" means for a row driven through the CRUD route.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' }),
    (0, swagger_1.ApiHeader)(DEVICE_ID_HEADER_DOC),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Headers)(DEVICE_ID_HEADER)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, lock_txn_hold_dto_1.LockTxnHoldDto]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "forceRelease", null);
__decorate([
    (0, common_1.Post)(':id/convert'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Close the hold onto the document it became',
        description: 'LOCKED → CONVERTED (terminal): stamps the conversion trail and drops the lease, so the ' +
            'parked work can never be resumed or billed again (409). There is no converted doc type ' +
            'to send — a hold becomes the document it was parked as, so the stored txhDocType names ' +
            'it — but txhConvertedAccYear does travel with the id, since a March hold can become an ' +
            'April document. Only the device holding the lease may convert it: 403 otherwise, and ' +
            'nothing is written.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' }),
    (0, swagger_1.ApiHeader)(DEVICE_ID_HEADER_DOC),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Headers)(DEVICE_ID_HEADER)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, lock_txn_hold_dto_1.ConvertTxnHoldDto]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "convert", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete hold by id',
        description: 'The row stays, flagged. Both unique indexes are partial on txh_is_deleted, so deleting ' +
            'frees the hold number and the device serial for reuse.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'txhId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)(ACC_YEAR_QUERY_DOC),
    (0, swagger_1.ApiOkResponse)({ type: txn_hold_response_dto_1.TxnHoldSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_hold_response_dto_1.TxnHoldErrorResponseDto }),
    __param(0, (0, common_1.Query)('txhId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Query)('txhAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TxnHoldController.prototype, "remove", null);
exports.TxnHoldController = TxnHoldController = __decorate([
    (0, swagger_1.ApiTags)('Transaction Hold'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('txn-holds'),
    (0, common_1.UseFilters)(txn_hold_exception_filter_1.TxnHoldExceptionFilter),
    __metadata("design:paramtypes", [txn_hold_service_1.TxnHoldService])
], TxnHoldController);
//# sourceMappingURL=txn-hold.controller.js.map