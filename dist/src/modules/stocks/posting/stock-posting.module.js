"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockPostingModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../../common/posting/posting.module");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_accounts_posting_service_1 = require("./stock-accounts-posting.service");
const stock_admin_controller_1 = require("./stock-admin.controller");
const stock_admin_service_1 = require("./stock-admin.service");
const stock_cogs_mode_service_1 = require("./stock-cogs-mode.service");
const stock_posting_service_1 = require("./stock-posting.service");
let StockPostingModule = class StockPostingModule {
};
exports.StockPostingModule = StockPostingModule;
exports.StockPostingModule = StockPostingModule = __decorate([
    (0, common_1.Module)({
        imports: [posting_module_1.CommonPostingModule, app_settings_module_1.AppSettingsModule],
        controllers: [stock_admin_controller_1.StockAdminController],
        providers: [
            stock_posting_service_1.StockPostingService,
            stock_accounts_posting_service_1.StockAccountsPostingService,
            stock_cogs_mode_service_1.StockCogsModeService,
            stock_accounts_posting_service_1.STOCK_COGS_MODE_PROVIDER,
            stock_admin_service_1.StockAdminService,
            stock_voucher_exception_filter_1.StockVoucherExceptionFilter,
        ],
        exports: [stock_posting_service_1.StockPostingService, stock_accounts_posting_service_1.StockAccountsPostingService],
    })
], StockPostingModule);
//# sourceMappingURL=stock-posting.module.js.map