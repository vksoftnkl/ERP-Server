"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemBatchStockModule = void 0;
const common_1 = require("@nestjs/common");
const itemBatchStockController_1 = require("./itemBatchStockController");
const itemBatchStockExceptionFilter_1 = require("./itemBatchStockExceptionFilter");
const itemBatchStockService_1 = require("./itemBatchStockService");
let ItemBatchStockModule = class ItemBatchStockModule {
};
exports.ItemBatchStockModule = ItemBatchStockModule;
exports.ItemBatchStockModule = ItemBatchStockModule = __decorate([
    (0, common_1.Module)({
        controllers: [itemBatchStockController_1.ItemBatchStockController],
        providers: [itemBatchStockService_1.ItemBatchStockService, itemBatchStockExceptionFilter_1.ItemBatchStockExceptionFilter],
    })
], ItemBatchStockModule);
//# sourceMappingURL=itemBatchStockModule.js.map