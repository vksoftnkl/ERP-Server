"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VouchersModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../../common/posting/posting.module");
const bill_balance_module_1 = require("../billBalance/bill-balance.module");
const vouchers_controller_1 = require("./vouchers.controller");
const vouchers_exception_filter_1 = require("./vouchers-exception.filter");
const voucher_types_service_1 = require("./voucher-types.service");
const voucher_lookups_service_1 = require("./voucher-lookups.service");
const voucher_register_service_1 = require("./voucher-register.service");
const voucher_cancel_service_1 = require("./voucher-cancel.service");
let VouchersModule = class VouchersModule {
};
exports.VouchersModule = VouchersModule;
exports.VouchersModule = VouchersModule = __decorate([
    (0, common_1.Module)({
        imports: [posting_module_1.CommonPostingModule, bill_balance_module_1.BillBalanceModule],
        controllers: [vouchers_controller_1.VouchersController],
        providers: [
            voucher_types_service_1.VoucherTypesService,
            voucher_lookups_service_1.VoucherLookupsService,
            voucher_register_service_1.VoucherRegisterService,
            voucher_cancel_service_1.VoucherCancelService,
            vouchers_exception_filter_1.VouchersExceptionFilter,
        ],
        exports: [voucher_types_service_1.VoucherTypesService, voucher_register_service_1.VoucherRegisterService],
    })
], VouchersModule);
//# sourceMappingURL=vouchers.module.js.map