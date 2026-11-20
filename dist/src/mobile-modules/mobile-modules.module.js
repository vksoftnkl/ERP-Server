"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileModulesModule = void 0;
const common_1 = require("@nestjs/common");
const mobile_bank_module_1 = require("./bank/mobile-bank.module");
const mobile_bill_module_1 = require("./bill/mobile-bill.module");
const mobile_customer_module_1 = require("./customer/mobile-customer.module");
const mobile_item_module_1 = require("./item/mobile-item.module");
const mobile_me_module_1 = require("./me/mobile-me.module");
const mobile_order_module_1 = require("./order/mobile-order.module");
const mobile_receipt_module_1 = require("./receipt/mobile-receipt.module");
const mobile_return_module_1 = require("./return/mobile-return.module");
const mobile_scheme_module_1 = require("./scheme/mobile-scheme.module");
const mobile_visit_module_1 = require("./visit/mobile-visit.module");
let MobileModulesModule = class MobileModulesModule {
};
exports.MobileModulesModule = MobileModulesModule;
exports.MobileModulesModule = MobileModulesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mobile_customer_module_1.MobileCustomerModule,
            mobile_item_module_1.MobileItemModule,
            mobile_order_module_1.MobileOrderModule,
            mobile_visit_module_1.MobileVisitModule,
            mobile_bill_module_1.MobileBillModule,
            mobile_receipt_module_1.MobileReceiptModule,
            mobile_return_module_1.MobileReturnModule,
            mobile_scheme_module_1.MobileSchemeModule,
            mobile_me_module_1.MobileMeModule,
            mobile_bank_module_1.MobileBankModule,
        ],
    })
], MobileModulesModule);
//# sourceMappingURL=mobile-modules.module.js.map