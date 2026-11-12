"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemLedgerModule = void 0;
const common_1 = require("@nestjs/common");
const app_settings_module_1 = require("../../../settings/appSettings/app-settings.module");
const item_ledger_controller_1 = require("./item-ledger.controller");
const item_ledger_service_1 = require("./item-ledger.service");
let ItemLedgerModule = class ItemLedgerModule {
};
exports.ItemLedgerModule = ItemLedgerModule;
exports.ItemLedgerModule = ItemLedgerModule = __decorate([
    (0, common_1.Module)({
        imports: [app_settings_module_1.AppSettingsModule],
        controllers: [item_ledger_controller_1.ItemLedgerController],
        providers: [item_ledger_service_1.ItemLedgerService],
        exports: [item_ledger_service_1.ItemLedgerService],
    })
], ItemLedgerModule);
//# sourceMappingURL=item-ledger.module.js.map