"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DcReturnModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const charge_detail_module_1 = require("../../master/charge-detail/charge-detail.module");
const tender_detail_module_1 = require("../../accountsModule/tenderDetail/tender-detail.module");
const posting_module_1 = require("../posting/posting.module");
const dc_return_controller_1 = require("./dc-return.controller");
const dc_return_exception_filter_1 = require("./dc-return-exception.filter");
const dc_return_service_1 = require("./dc-return.service");
let DcReturnModule = class DcReturnModule {
};
exports.DcReturnModule = DcReturnModule;
exports.DcReturnModule = DcReturnModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, charge_detail_module_1.ChargeDetailModule, tender_detail_module_1.TenderDetailModule, posting_module_1.SalesPostingModule],
        controllers: [dc_return_controller_1.DcReturnController],
        providers: [dc_return_service_1.DcReturnService, dc_return_exception_filter_1.DcReturnExceptionFilter],
        exports: [dc_return_service_1.DcReturnService],
    })
], DcReturnModule);
//# sourceMappingURL=dc-return.module.js.map