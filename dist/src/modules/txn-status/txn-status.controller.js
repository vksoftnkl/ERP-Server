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
exports.TxnStatusController = exports.PendingTxnStatusQueryDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const swagger_2 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../common/constants/api-version");
const txn_status_service_1 = require("./txn-status.service");
class PendingTxnStatusQueryDto {
    companyId;
    branchId;
    accYear;
    upToDate;
    srcModule;
    limit;
    offset;
}
exports.PendingTxnStatusQueryDto = PendingTxnStatusQueryDto;
__decorate([
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], PendingTxnStatusQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ format: 'uuid', description: 'Omit for every branch of the company.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], PendingTxnStatusQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}-\d{4}$/, { message: 'accYear must be YYYY-YYYY' }),
    __metadata("design:type", String)
], PendingTxnStatusQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ example: '2026-09-28', description: 'Steps up to the end of this day. Defaults to now.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'upToDate must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], PendingTxnStatusQueryDto.prototype, "upToDate", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ example: 'SALES', description: 'SALES | PURCHASE | INVENTORY | ACCOUNTS | POS | SERVICE | OTHER' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], PendingTxnStatusQueryDto.prototype, "srcModule", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ default: 200, maximum: 2000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === undefined || value === '' ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], PendingTxnStatusQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === undefined || value === '' ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PendingTxnStatusQueryDto.prototype, "offset", void 0);
let TxnStatusController = class TxnStatusController {
    service;
    constructor(service) {
        this.service = service;
    }
    async pending(query) {
        const data = await this.service.pending(query);
        return {
            success: true,
            message: data.total ? `${data.total} documents still pending` : 'Nothing is pending',
            data,
        };
    }
};
exports.TxnStatusController = TxnStatusController;
__decorate([
    (0, common_1.Get)('pending'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Every document whose latest status step is still DRAFT, HELD, CONFIRMED or IN_TRANSIT',
        description: 'One row per pending document (module, doc type, refno, status, since, who), plus counts per module, doc type and status for the day-close summary. The latest step is by sequence number, never by timestamp.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'items, counts and the total before paging.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PendingTxnStatusQueryDto]),
    __metadata("design:returntype", Promise)
], TxnStatusController.prototype, "pending", null);
exports.TxnStatusController = TxnStatusController = __decorate([
    (0, swagger_1.ApiTags)('Transaction Status'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('txn-status'),
    __metadata("design:paramtypes", [txn_status_service_1.TxnStatusService])
], TxnStatusController);
//# sourceMappingURL=txn-status.controller.js.map