"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemStockBalanceModule = void 0;
const common_1 = require("@nestjs/common");
const itemStockBalanceController_1 = require("./itemStockBalanceController");
const itemStockBalanceExceptionFilter_1 = require("./itemStockBalanceExceptionFilter");
const itemstockBalanceService_1 = require("./itemstockBalanceService");
let ItemStockBalanceModule = class ItemStockBalanceModule {
};
exports.ItemStockBalanceModule = ItemStockBalanceModule;
exports.ItemStockBalanceModule = ItemStockBalanceModule = __decorate([
    (0, common_1.Module)({
        controllers: [itemStockBalanceController_1.ItemStockBalanceController],
        providers: [itemstockBalanceService_1.ItemStockBalanceService, itemStockBalanceExceptionFilter_1.ItemStockBalanceExceptionFilter],
    })
], ItemStockBalanceModule);
//# sourceMappingURL=itemStockBalanceModule.js.map