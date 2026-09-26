"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridDetailsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const grid_detail_exception_filter_1 = require("./grid-detail-exception.filter");
const grid_details_controller_1 = require("./grid-details.controller");
const grid_details_service_1 = require("./grid-details.service");
let GridDetailsModule = class GridDetailsModule {
};
exports.GridDetailsModule = GridDetailsModule;
exports.GridDetailsModule = GridDetailsModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [grid_details_controller_1.GridDetailsController],
        providers: [grid_details_service_1.GridDetailsService, grid_detail_exception_filter_1.GridDetailExceptionFilter],
    })
], GridDetailsModule);
//# sourceMappingURL=grid-details.module.js.map