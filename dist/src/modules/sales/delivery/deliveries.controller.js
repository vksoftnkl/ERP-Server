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
exports.DeliveriesController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const deliveries_service_1 = require("./deliveries.service");
const delivery_exception_filter_1 = require("./delivery-exception.filter");
const delivery_note_dto_1 = require("./dto/delivery-note.dto");
const ok = (message, data) => ({ success: true, message, data });
let DeliveriesController = class DeliveriesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async mode(dto) {
        return ok('Delivery mode changed', await this.service.mode(dto));
    }
    async exceptions(q) {
        return ok('Delivery exceptions fetched', await this.service.exceptions(q));
    }
};
exports.DeliveriesController = DeliveriesController;
__decorate([
    (0, common_1.Post)('mode'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "A posted bill's Pickup ↔ Dispatch switch (Sales Bill EDIT, 403 DELIVERY_RIGHT_MODE), with a reason and a DELIVERY_MODE " +
            'step. 409 DELIVERY_MODE_INSTANT / DELIVERY_MODE_GIVEN; 422 DELIVERY_MODE_INVALID / DELIVERY_MODE_REASON_REQUIRED.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.DeliveryModeDto]),
    __metadata("design:returntype", Promise)
], DeliveriesController.prototype, "mode", null);
__decorate([
    (0, common_1.Get)('exceptions'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Over-given bill lines (settled > billed, decision 46) of a branch: rows[] { billId, billAccYear, billRefno, billItemId, lineNo, ' +
            'itemName, godownName, billedQty, settledQty, overQty, lastEvent } (menu 304 VIEW, 403 DELIVERY_RIGHT_VIEW)',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delivery_note_dto_1.DeliveryExceptionsQueryDto]),
    __metadata("design:returntype", Promise)
], DeliveriesController.prototype, "exceptions", null);
exports.DeliveriesController = DeliveriesController = __decorate([
    (0, swagger_1.ApiTags)('Deliveries'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('deliveries'),
    (0, common_1.UseFilters)(delivery_exception_filter_1.DeliveryExceptionFilter),
    __metadata("design:paramtypes", [deliveries_service_1.DeliveriesService])
], DeliveriesController);
//# sourceMappingURL=deliveries.controller.js.map