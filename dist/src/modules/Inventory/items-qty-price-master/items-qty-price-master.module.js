"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsQtyPriceMasterModule = void 0;
const common_1 = require("@nestjs/common");
const item_qty_price_exception_filter_1 = require("./item-qty-price-exception.filter");
const items_qty_price_master_controller_1 = require("./items-qty-price-master.controller");
const items_qty_price_master_service_1 = require("./items-qty-price-master.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let ItemsQtyPriceMasterModule = class ItemsQtyPriceMasterModule {
};
exports.ItemsQtyPriceMasterModule = ItemsQtyPriceMasterModule;
exports.ItemsQtyPriceMasterModule = ItemsQtyPriceMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_qty_price_master_controller_1.ItemsQtyPriceMasterController],
        providers: [items_qty_price_master_service_1.ItemsQtyPriceMasterService, item_qty_price_exception_filter_1.ItemQtyPriceExceptionFilter],
        exports: [items_qty_price_master_service_1.ItemsQtyPriceMasterService],
    })
], ItemsQtyPriceMasterModule);
//# sourceMappingURL=items-qty-price-master.module.js.map