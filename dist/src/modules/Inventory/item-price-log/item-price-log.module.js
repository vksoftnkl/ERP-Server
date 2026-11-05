"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceLogModule = void 0;
const common_1 = require("@nestjs/common");
const item_price_log_controller_1 = require("./item-price-log.controller");
const item_price_log_service_1 = require("./item-price-log.service");
const price_change_log_service_1 = require("./price-change-log.service");
const price_master_writer_service_1 = require("./price-master-writer.service");
let ItemPriceLogModule = class ItemPriceLogModule {
};
exports.ItemPriceLogModule = ItemPriceLogModule;
exports.ItemPriceLogModule = ItemPriceLogModule = __decorate([
    (0, common_1.Module)({
        controllers: [item_price_log_controller_1.ItemPriceLogController],
        providers: [price_master_writer_service_1.PriceMasterWriter, price_change_log_service_1.PriceChangeLogService, item_price_log_service_1.ItemPriceLogService],
        exports: [price_master_writer_service_1.PriceMasterWriter],
    })
], ItemPriceLogModule);
//# sourceMappingURL=item-price-log.module.js.map