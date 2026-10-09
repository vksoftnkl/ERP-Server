"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TillModule = void 0;
const common_1 = require("@nestjs/common");
const app_settings_module_1 = require("../settings/appSettings/app-settings.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const posting_module_1 = require("../../common/posting/posting.module");
const till_controller_1 = require("./till.controller");
const till_masters_controller_1 = require("./till-masters.controller");
const till_exception_filter_1 = require("./till-exception.filter");
const till_context_service_1 = require("./till-context.service");
const till_approval_service_1 = require("./services/till-approval.service");
const till_day_service_1 = require("./services/till-day.service");
const till_event_service_1 = require("./services/till-event.service");
const till_ledger_service_1 = require("./services/till-ledger.service");
const till_masters_service_1 = require("./services/till-masters.service");
const till_movement_service_1 = require("./services/till-movement.service");
const till_posting_service_1 = require("./services/till-posting.service");
const till_session_service_1 = require("./services/till-session.service");
const till_slip_check_service_1 = require("./services/till-slip-check.service");
let TillModule = class TillModule {
};
exports.TillModule = TillModule;
exports.TillModule = TillModule = __decorate([
    (0, common_1.Module)({
        imports: [app_settings_module_1.AppSettingsModule, audit_log_module_1.AuditLogModule, posting_module_1.CommonPostingModule],
        controllers: [till_controller_1.TillController, till_masters_controller_1.TillMastersController],
        providers: [
            till_approval_service_1.TillApprovalService,
            till_context_service_1.TillContextService,
            till_day_service_1.TillDayService,
            till_event_service_1.TillEventService,
            till_ledger_service_1.TillLedgerService,
            till_posting_service_1.TillPostingService,
            till_session_service_1.TillSessionService,
            till_masters_service_1.TillMastersService,
            till_movement_service_1.TillMovementService,
            till_slip_check_service_1.TillSlipCheckService,
            till_exception_filter_1.TillExceptionFilter,
        ],
        exports: [till_session_service_1.TillSessionService, till_approval_service_1.TillApprovalService, till_event_service_1.TillEventService],
    })
], TillModule);
//# sourceMappingURL=till.module.js.map