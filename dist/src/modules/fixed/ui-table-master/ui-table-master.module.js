"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UiTableMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const ui_table_master_controller_1 = require("./ui-table-master.controller");
const ui_table_master_exception_filter_1 = require("./ui-table-master-exception.filter");
const ui_table_master_service_1 = require("./ui-table-master.service");
let UiTableMasterModule = class UiTableMasterModule {
};
exports.UiTableMasterModule = UiTableMasterModule;
exports.UiTableMasterModule = UiTableMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [ui_table_master_controller_1.UiTableMasterController],
        providers: [ui_table_master_service_1.UiTableMasterService, ui_table_master_exception_filter_1.UiTableMasterExceptionFilter],
    })
], UiTableMasterModule);
//# sourceMappingURL=ui-table-master.module.js.map