"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockTransferModule = void 0;
const common_1 = require("@nestjs/common");
const stock_voucher_module_1 = require("../stock-voucher/stock-voucher.module");
const stock_transfer_controller_1 = require("./stock-transfer.controller");
const stock_transfer_receive_controller_1 = require("./stock-transfer-receive.controller");
const stock_transfer_service_1 = require("./stock-transfer.service");
let StockTransferModule = class StockTransferModule {
};
exports.StockTransferModule = StockTransferModule;
exports.StockTransferModule = StockTransferModule = __decorate([
    (0, common_1.Module)({
        imports: [stock_voucher_module_1.StockVoucherModule],
        controllers: [stock_transfer_controller_1.StockTransferController, stock_transfer_receive_controller_1.StockTransferReceiveController],
        providers: [stock_transfer_service_1.StockTransferService],
        exports: [stock_transfer_service_1.StockTransferService],
    })
], StockTransferModule);
//# sourceMappingURL=stock-transfer.module.js.map