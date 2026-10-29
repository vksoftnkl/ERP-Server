"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemInwardHistoryModule = void 0;
const common_1 = require("@nestjs/common");
const item_inward_history_controller_1 = require("./item-inward-history.controller");
const item_inward_history_service_1 = require("./item-inward-history.service");
let ItemInwardHistoryModule = class ItemInwardHistoryModule {
};
exports.ItemInwardHistoryModule = ItemInwardHistoryModule;
exports.ItemInwardHistoryModule = ItemInwardHistoryModule = __decorate([
    (0, common_1.Module)({
        controllers: [item_inward_history_controller_1.ItemInwardHistoryController],
        providers: [item_inward_history_service_1.ItemInwardHistoryService],
    })
], ItemInwardHistoryModule);
//# sourceMappingURL=item-inward-history.module.js.map