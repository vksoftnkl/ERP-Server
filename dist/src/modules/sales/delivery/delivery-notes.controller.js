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
exports.DeliveryNotesController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const delivery_exception_filter_1 = require("./delivery-exception.filter");
const delivery_note_service_1 = require("./delivery-note.service");
const delivery_note_dto_1 = require("./dto/delivery-note.dto");
const ok = (message, data) => ({ success: true, message, data });
let DeliveryNotesController = class DeliveryNotesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        return ok(dto.sdnId ? 'Delivery note saved' : 'Delivery note created', await this.service.save(dto));
    }
    async validate(dto) {
        return ok('Delivery note validated', await this.service.validate(dto));
    }
    async post(dto) {
        return ok('Delivery note posted', await this.service.post(dto));
    }
    async get(q) {
        return ok('Delivery note fetched', await this.service.get(q));
    }
    async cancel(dto) {
        return ok('Delivery note cancelled', await this.service.cancel(dto));
    }
    async remove(dto) {
        return ok('Draft delivery note deleted', await this.service.delete(dto));
    }
    async goodsBack(dto) {
        return ok('Goods back recorded', await this.service.goodsBack(dto));
    }
    async scan(q) {
        return ok('Scan resolved', await this.service.scan(q));
    }
    async openLines(dto) {
        return ok('Open lines fetched', await this.service.openLines(dto));
    }
    async lots(q) {
        return ok('Lots fetched', await this.service.lots(q));
    }
};
exports.DeliveryNotesController = DeliveryNotesController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (menu 305 CREATE) or update (EDIT) a DRAFT note. A draft holds nothing (Q12). Numbered per device at the first ' +
            'save (DN/<year>/<device>/00001). Answers the get payload. 409 DN_NOT_DRAFT / DN_REVISION_STALE / DN_GODOWN_LOCKED; ' +
            '422 DN_GODOWN_REQUIRED / DN_GODOWN_NOT_IN_BRANCH / DN_QTY_NEGATIVE / DN_LOT_INVALID; 409 DN_BILL_*; 403 DN_GODOWN_RIGHT.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.SaveDeliveryNoteDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Dry-run the post over the body (CREATE or EDIT). Writes nothing. { ok, errors[], warnings[], infos[], totals, load, rights } — ' +
            'each finding { code, severity, field, lineNo, params, message, user }.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.ValidateDeliveryNoteDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save and post in one transaction (menu 305 POST; OVERRIDE for other-godown lines): one GIVEN event per line, lot / godown ' +
            'corrections through the stock engine, the bills\' status recomputed. Answers the get payload + postedBills[] + corrections[]. ' +
            '409 DN_QTY_OVER_PENDING / DN_WARN_NOT_CONFIRMED / DN_GODOWN_FROZEN / DN_STOCK_NEGATIVE; 422 DN_NO_LINES / DN_*_REQUIRED.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.PostDeliveryNoteDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "post", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One note: { note, bills[], lines[], elsewhere[], totals, load, rights } (menu 305 VIEW)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.DeliveryNoteGetQueryDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a POSTED note (CANCEL): CANCEL events for what is still out, every correction voucher cancelled, bills recomputed. ' +
            '422 DN_CANCEL_REASON_REQUIRED; 409 DN_ALREADY_CANCELLED / DN_GOODS_BACK_NOT_POSTED (a draft is deleted).',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.CancelDeliveryNoteDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a DRAFT note (DELETE). 409 DN_NOT_DRAFT on a posted one.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.DeliveryNoteKeysDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('goods-back'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Goods refused at the door (POST right): GOODS_BACK events, the line corrections undone for the qty, bills recomputed; the ' +
            'note stays POSTED. A re-sent request whose sdeId exists writes nothing (replayed: true). 409 DN_GOODS_BACK_OVER / ' +
            'DN_GOODS_BACK_NOT_POSTED / DN_ALREADY_CANCELLED; 422 DN_GOODS_BACK_REASON_REQUIRED.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.GoodsBackDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "goodsBack", null);
__decorate([
    (0, common_1.Get)('scan'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'A scanned / typed code in one godown (VIEW): NXB1- bill QR, NXD1- gate-pass QR, or a bill no. { kind, bill, bills[], lines[], ' +
            'elsewhere[], note } — bills[] in the get payload\'s shape ([] for a NOTE); each line carries unitKg. ' +
            '404 DN_SCAN_UNKNOWN; 409 DN_SCAN_NO_OPEN_HERE / DELIVERY_NOTHING_OPEN.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.DeliveryScanQueryDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "scan", null);
__decorate([
    (0, common_1.Post)('open-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "The bills' open lines in one godown (F4 Add; F8 from 304): { bills[], lines[], elsewhere[] } (VIEW). bills[] has the get " +
            "payload's shape, linesHere / linesElsewhere counted against godownId; each line carries unitKg (kg of one package).",
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.OpenLinesDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "openLines", null);
__decorate([
    (0, common_1.Get)('lots'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "The Lot cell's F2 list: lots[] { lotId, lotNo, expiryDate, owned, notDelivered, physical } in base units (VIEW)",
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.DeliveryLotsQueryDto]),
    __metadata("design:returntype", Promise)
], DeliveryNotesController.prototype, "lots", null);
exports.DeliveryNotesController = DeliveryNotesController = __decorate([
    (0, swagger_1.ApiTags)('Delivery Notes'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('delivery-notes'),
    (0, common_1.UseFilters)(delivery_exception_filter_1.DeliveryExceptionFilter),
    __metadata("design:paramtypes", [delivery_note_service_1.DeliveryNoteService])
], DeliveryNotesController);
//# sourceMappingURL=delivery-notes.controller.js.map