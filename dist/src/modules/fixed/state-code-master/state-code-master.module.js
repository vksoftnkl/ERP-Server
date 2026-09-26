"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateCodeMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const state_code_master_controller_1 = require("./state-code-master.controller");
const state_code_master_exception_filter_1 = require("./state-code-master-exception.filter");
const state_code_master_service_1 = require("./state-code-master.service");
let StateCodeMasterModule = class StateCodeMasterModule {
};
exports.StateCodeMasterModule = StateCodeMasterModule;
exports.StateCodeMasterModule = StateCodeMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [state_code_master_controller_1.StateCodeMasterController],
        providers: [state_code_master_service_1.StateCodeMasterService, state_code_master_exception_filter_1.StateCodeMasterExceptionFilter],
    })
], StateCodeMasterModule);
//# sourceMappingURL=state-code-master.module.js.map