"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssuedChequesModule = void 0;
const common_1 = require("@nestjs/common");
const bill_balance_module_1 = require("../billBalance/bill-balance.module");
const vouchers_module_1 = require("../vouchers/vouchers.module");
const issued_cheques_controller_1 = require("./issued-cheques.controller");
const issued_cheques_exception_filter_1 = require("./issued-cheques-exception.filter");
const issued_cheques_service_1 = require("./issued-cheques.service");
const cheque_books_service_1 = require("./cheque-books.service");
let IssuedChequesModule = class IssuedChequesModule {
};
exports.IssuedChequesModule = IssuedChequesModule;
exports.IssuedChequesModule = IssuedChequesModule = __decorate([
    (0, common_1.Module)({
        imports: [vouchers_module_1.VouchersModule, bill_balance_module_1.BillBalanceModule],
        controllers: [issued_cheques_controller_1.IssuedChequesController, issued_cheques_controller_1.ChequeBooksController],
        providers: [issued_cheques_service_1.IssuedChequesService, cheque_books_service_1.ChequeBooksService, issued_cheques_exception_filter_1.IssuedChequesExceptionFilter],
    })
], IssuedChequesModule);
//# sourceMappingURL=issued-cheques.module.js.map