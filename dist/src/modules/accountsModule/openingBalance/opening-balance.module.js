"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpeningBalanceModule = void 0;
const common_1 = require("@nestjs/common");
const opening_balance_controller_1 = require("./opening-balance.controller");
const opening_balance_exception_filter_1 = require("./opening-balance-exception.filter");
const opening_balance_service_1 = require("./opening-balance.service");
const bill_wise_service_1 = require("./bill-wise.service");
const carry_forward_service_1 = require("./carry-forward.service");
let OpeningBalanceModule = class OpeningBalanceModule {
};
exports.OpeningBalanceModule = OpeningBalanceModule;
exports.OpeningBalanceModule = OpeningBalanceModule = __decorate([
    (0, common_1.Module)({
        controllers: [opening_balance_controller_1.OpeningBalanceController],
        providers: [
            opening_balance_service_1.OpeningBalanceService,
            bill_wise_service_1.BillWiseService,
            carry_forward_service_1.CarryForwardService,
            opening_balance_exception_filter_1.OpeningBalanceExceptionFilter,
        ],
        exports: [opening_balance_service_1.OpeningBalanceService, carry_forward_service_1.CarryForwardService],
    })
], OpeningBalanceModule);
//# sourceMappingURL=opening-balance.module.js.map