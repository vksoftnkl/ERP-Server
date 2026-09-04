"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GodownsMasterModule = void 0;
const common_1 = require("@nestjs/common");
const godown_exception_filter_1 = require("./godown-exception.filter");
const godowns_master_controller_1 = require("./godowns-master.controller");
const godowns_master_service_1 = require("./godowns-master.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let GodownsMasterModule = class GodownsMasterModule {
};
exports.GodownsMasterModule = GodownsMasterModule;
exports.GodownsMasterModule = GodownsMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [godowns_master_controller_1.GodownsMasterController],
        providers: [godowns_master_service_1.GodownsMasterService, godown_exception_filter_1.GodownExceptionFilter],
    })
], GodownsMasterModule);
//# sourceMappingURL=godowns-master.module.js.map