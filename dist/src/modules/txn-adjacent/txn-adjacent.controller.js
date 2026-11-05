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
exports.TxnAdjacentController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const txn_adjacent_query_dto_1 = require("./dto/txn-adjacent-query.dto");
const txn_adjacent_response_dto_1 = require("./dto/txn-adjacent-response.dto");
const txn_adjacent_registry_1 = require("./txn-adjacent.registry");
const txn_adjacent_service_1 = require("./txn-adjacent.service");
let TxnAdjacentController = class TxnAdjacentController {
    service;
    constructor(service) {
        this.service = service;
    }
    async adjacent(q) {
        const data = await this.service.adjacent(q);
        const label = txn_adjacent_registry_1.TXN_DOC_REGISTRY[q.docType].label;
        return {
            success: true,
            message: data.doc
                ? `${data.doc.refno ?? '(draft)'} is the ${q.direction} ${label}`
                : `No ${q.direction} ${label} — this is the end of the list`,
            data,
        };
    }
};
exports.TxnAdjacentController = TxnAdjacentController;
__decorate([
    (0, common_1.Get)('adjacent'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The document entered just before or just after this one, for any document type',
        description: 'notes 142 — Previous / Next (Ctrl+PgUp / Ctrl+PgDn) on every transaction screen. ' +
            'Returns a KEY; load it with the screen’s own /get.\n\n' +
            '**prev = older, next = newer**, on (date, serial, created on, id) — the order the lists ' +
            'show. A draft with no serial yet sits where its list draws it: at the NEW end of its date ' +
            'for a sale bill, receipt or payment, at the OLD end for a Voucher Register voucher.\n\n' +
            'Walked: this company / branch / year, not deleted, cancelled included, the docType’s own ' +
            'rows only (OPENING_STOCK walks svh_voucher_type OPENING; STOCK_ADJUSTMENT its four kinds; ' +
            'STOCK_TRANSFER TRANSFER_OUT; STOCK_TRANSFER_RECEIPT TRANSFER_IN; RECEIPT / PAYMENT their ' +
            'one type, never a PDC child or a reversal; VOUCHER the register types), and only on a menu ' +
            'the caller may VIEW. VOUCHER reads each row on its own type’s menu, as /vouchers/adjacent.\n\n' +
            '`typeCode` walks one type; `status` / `fromDate` / `toDate` are the list’s filters. Omit ' +
            '`docId` on an empty screen: prev → the newest document, next → the oldest. `doc` is null ' +
            'at either end.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: txn_adjacent_response_dto_1.TxnAdjacentSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: txn_adjacent_response_dto_1.TxnAdjacentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: txn_adjacent_response_dto_1.TxnAdjacentErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: txn_adjacent_response_dto_1.TxnAdjacentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [txn_adjacent_query_dto_1.TxnAdjacentQueryDto]),
    __metadata("design:returntype", Promise)
], TxnAdjacentController.prototype, "adjacent", null);
exports.TxnAdjacentController = TxnAdjacentController = __decorate([
    (0, swagger_1.ApiTags)('Transactions'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('txn'),
    __metadata("design:paramtypes", [txn_adjacent_service_1.TxnAdjacentService])
], TxnAdjacentController);
//# sourceMappingURL=txn-adjacent.controller.js.map