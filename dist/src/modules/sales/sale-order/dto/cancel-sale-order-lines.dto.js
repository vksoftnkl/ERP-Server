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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelSaleOrderLinesDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class CancelSaleOrderLinesDto {
    soiCancelReason;
}
exports.CancelSaleOrderLinesDto = CancelSaleOrderLinesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 250,
        nullable: true,
        description: 'Why the remaining quantity is being cancelled. Written to ' +
            'sale_order_item.soi_cancel_reason on every line this call closes out — the lines it ' +
            'leaves alone keep whatever they already held — and carried to the status trail ' +
            '(public.txn_status_log.tsl_remarks), which sale_order has no column of its own for. ' +
            "Omitted, the line column is left untouched and the trail records 'No reason recorded' " +
            'rather than failing the call.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], CancelSaleOrderLinesDto.prototype, "soiCancelReason", void 0);
//# sourceMappingURL=cancel-sale-order-lines.dto.js.map