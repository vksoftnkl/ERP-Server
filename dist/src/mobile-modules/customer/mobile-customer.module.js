"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileCustomerModule = void 0;
const common_1 = require("@nestjs/common");
const customer_module_1 = require("../../modules/sales/customer/customer.module");
const customer_exception_filter_1 = require("../../modules/sales/customer/customer-exception.filter");
const mobile_customer_controller_1 = require("./mobile-customer.controller");
const mobile_customer_service_1 = require("./mobile-customer.service");
let MobileCustomerModule = class MobileCustomerModule {
};
exports.MobileCustomerModule = MobileCustomerModule;
exports.MobileCustomerModule = MobileCustomerModule = __decorate([
    (0, common_1.Module)({
        imports: [customer_module_1.CustomerModule],
        controllers: [mobile_customer_controller_1.MobileCustomerController],
        providers: [mobile_customer_service_1.MobileCustomerService, customer_exception_filter_1.CustomerExceptionFilter],
    })
], MobileCustomerModule);
//# sourceMappingURL=mobile-customer.module.js.map