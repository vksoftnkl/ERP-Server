"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderDetailModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const tender_detail_controller_1 = require("./tender-detail.controller");
const tender_detail_exception_filter_1 = require("./tender-detail-exception.filter");
const tender_detail_service_1 = require("./tender-detail.service");
let TenderDetailModule = class TenderDetailModule {
};
exports.TenderDetailModule = TenderDetailModule;
exports.TenderDetailModule = TenderDetailModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [tender_detail_controller_1.TenderDetailController],
        providers: [tender_detail_service_1.TenderDetailService, tender_detail_exception_filter_1.TenderDetailExceptionFilter],
        exports: [tender_detail_service_1.TenderDetailService],
    })
], TenderDetailModule);
//# sourceMappingURL=tender-detail.module.js.map