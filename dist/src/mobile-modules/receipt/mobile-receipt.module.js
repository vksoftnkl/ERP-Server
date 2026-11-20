"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileReceiptModule = void 0;
const common_1 = require("@nestjs/common");
const receipt_module_1 = require("../../modules/accountsModule/receipt/receipt.module");
const receipt_exception_filter_1 = require("../../modules/accountsModule/receipt/receipt-exception.filter");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_receipt_controller_1 = require("./mobile-receipt.controller");
const mobile_receipt_service_1 = require("./mobile-receipt.service");
const mobile_receipt_status_service_1 = require("./mobile-receipt-status.service");
let MobileReceiptModule = class MobileReceiptModule {
};
exports.MobileReceiptModule = MobileReceiptModule;
exports.MobileReceiptModule = MobileReceiptModule = __decorate([
    (0, common_1.Module)({
        imports: [receipt_module_1.ReceiptModule],
        controllers: [mobile_receipt_controller_1.MobileReceiptController],
        providers: [
            mobile_receipt_service_1.MobileReceiptService,
            mobile_receipt_status_service_1.MobileReceiptStatusService,
            receipt_exception_filter_1.ReceiptExceptionFilter,
            mobile_exception_filter_1.MobileExceptionFilter,
        ],
    })
], MobileReceiptModule);
//# sourceMappingURL=mobile-receipt.module.js.map