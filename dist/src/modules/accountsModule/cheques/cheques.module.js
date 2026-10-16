"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChequesModule = void 0;
const common_1 = require("@nestjs/common");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const bill_balance_module_1 = require("../billBalance/bill-balance.module");
const cheques_controller_1 = require("./cheques.controller");
const cheques_exception_filter_1 = require("./cheques-exception.filter");
const cheques_service_1 = require("./cheques.service");
const cheque_deposit_service_1 = require("./cheque-deposit.service");
const cheque_clear_service_1 = require("./cheque-clear.service");
const cheque_bounce_service_1 = require("./cheque-bounce.service");
const cheque_reissue_service_1 = require("./cheque-reissue.service");
const cheque_return_service_1 = require("./cheque-return.service");
let ChequesModule = class ChequesModule {
};
exports.ChequesModule = ChequesModule;
exports.ChequesModule = ChequesModule = __decorate([
    (0, common_1.Module)({
        imports: [app_settings_module_1.AppSettingsModule, bill_balance_module_1.BillBalanceModule],
        controllers: [cheques_controller_1.ChequesController],
        providers: [
            cheques_service_1.ChequesService,
            cheque_deposit_service_1.ChequeDepositService,
            cheque_clear_service_1.ChequeClearService,
            cheque_bounce_service_1.ChequeBounceService,
            cheque_reissue_service_1.ChequeReissueService,
            cheque_return_service_1.ChequeReturnService,
            cheques_exception_filter_1.ChequesExceptionFilter,
        ],
        exports: [cheques_service_1.ChequesService],
    })
], ChequesModule);
//# sourceMappingURL=cheques.module.js.map