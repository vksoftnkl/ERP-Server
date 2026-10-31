"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../../common/posting/posting.module");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const till_module_1 = require("../../till/till.module");
const tender_detail_module_1 = require("../tenderDetail/tender-detail.module");
const expense_controller_1 = require("./expense.controller");
const expense_exception_filter_1 = require("./expense-exception.filter");
const expense_service_1 = require("./expense.service");
let ExpenseModule = class ExpenseModule {
};
exports.ExpenseModule = ExpenseModule;
exports.ExpenseModule = ExpenseModule = __decorate([
    (0, common_1.Module)({
        imports: [posting_module_1.CommonPostingModule, tender_detail_module_1.TenderDetailModule, till_module_1.TillModule, app_settings_module_1.AppSettingsModule],
        controllers: [expense_controller_1.ExpenseController],
        providers: [expense_service_1.ExpenseService, expense_exception_filter_1.ExpenseExceptionFilter],
    })
], ExpenseModule);
//# sourceMappingURL=expense.module.js.map