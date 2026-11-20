"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileReturnModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../modules/sales/posting/posting.module");
const sale_return_module_1 = require("../../modules/sales/sale-return/sale-return.module");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_return_controller_1 = require("./mobile-return.controller");
const mobile_return_exception_filter_1 = require("./mobile-return-exception.filter");
const mobile_return_service_1 = require("./mobile-return.service");
const mobile_return_status_service_1 = require("./mobile-return-status.service");
let MobileReturnModule = class MobileReturnModule {
};
exports.MobileReturnModule = MobileReturnModule;
exports.MobileReturnModule = MobileReturnModule = __decorate([
    (0, common_1.Module)({
        imports: [sale_return_module_1.SaleReturnModule, posting_module_1.SalesPostingModule],
        controllers: [mobile_return_controller_1.MobileReturnController],
        providers: [
            mobile_return_service_1.MobileReturnService,
            mobile_return_status_service_1.MobileReturnStatusService,
            mobile_return_exception_filter_1.MobileReturnExceptionFilter,
            mobile_exception_filter_1.MobileExceptionFilter,
        ],
    })
], MobileReturnModule);
//# sourceMappingURL=mobile-return.module.js.map