"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsReorderMasterModule = void 0;
const common_1 = require("@nestjs/common");
const item_reorder_exception_filter_1 = require("./item-reorder-exception.filter");
const items_reorder_master_controller_1 = require("./items-reorder-master.controller");
const items_reorder_master_service_1 = require("./items-reorder-master.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let ItemsReorderMasterModule = class ItemsReorderMasterModule {
};
exports.ItemsReorderMasterModule = ItemsReorderMasterModule;
exports.ItemsReorderMasterModule = ItemsReorderMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_reorder_master_controller_1.ItemsReorderMasterController],
        providers: [items_reorder_master_service_1.ItemsReorderMasterService, item_reorder_exception_filter_1.ItemReorderExceptionFilter],
        exports: [items_reorder_master_service_1.ItemsReorderMasterService],
    })
], ItemsReorderMasterModule);
//# sourceMappingURL=items-reorder-master.module.js.map