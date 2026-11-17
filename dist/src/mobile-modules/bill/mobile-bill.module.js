"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileBillModule = void 0;
const common_1 = require("@nestjs/common");
const bill_module_1 = require("../../modules/sales/bill/bill.module");
const bill_exception_filter_1 = require("../../modules/sales/bill/bill-exception.filter");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_bill_controller_1 = require("./mobile-bill.controller");
const mobile_bill_service_1 = require("./mobile-bill.service");
let MobileBillModule = class MobileBillModule {
};
exports.MobileBillModule = MobileBillModule;
exports.MobileBillModule = MobileBillModule = __decorate([
    (0, common_1.Module)({
        imports: [bill_module_1.BillModule],
        controllers: [mobile_bill_controller_1.MobileBillController],
        providers: [mobile_bill_service_1.MobileBillService, bill_exception_filter_1.BillExceptionFilter, mobile_exception_filter_1.MobileExceptionFilter],
    })
], MobileBillModule);
//# sourceMappingURL=mobile-bill.module.js.map