"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderSettlementModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../../common/posting/posting.module");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const till_module_1 = require("../../till/till.module");
const tender_settlement_controller_1 = require("./tender-settlement.controller");
const tender_settlement_exception_filter_1 = require("./tender-settlement-exception.filter");
const tender_settlement_exceptions_service_1 = require("./tender-settlement-exceptions.service");
const tender_settlement_service_1 = require("./tender-settlement.service");
let TenderSettlementModule = class TenderSettlementModule {
};
exports.TenderSettlementModule = TenderSettlementModule;
exports.TenderSettlementModule = TenderSettlementModule = __decorate([
    (0, common_1.Module)({
        imports: [posting_module_1.CommonPostingModule, app_settings_module_1.AppSettingsModule, till_module_1.TillModule],
        controllers: [tender_settlement_controller_1.TenderSettlementController],
        providers: [
            tender_settlement_service_1.TenderSettlementService,
            tender_settlement_exceptions_service_1.TenderSettlementExceptionService,
            tender_settlement_exception_filter_1.TenderSettlementExceptionFilter,
        ],
    })
], TenderSettlementModule);
//# sourceMappingURL=tender-settlement.module.js.map