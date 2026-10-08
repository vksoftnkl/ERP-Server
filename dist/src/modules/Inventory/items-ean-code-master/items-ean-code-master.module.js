"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsEanCodeMasterModule = void 0;
const common_1 = require("@nestjs/common");
const item_ean_code_exception_filter_1 = require("./item-ean-code-exception.filter");
const items_ean_code_master_controller_1 = require("./items-ean-code-master.controller");
const items_ean_code_master_service_1 = require("./items-ean-code-master.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let ItemsEanCodeMasterModule = class ItemsEanCodeMasterModule {
};
exports.ItemsEanCodeMasterModule = ItemsEanCodeMasterModule;
exports.ItemsEanCodeMasterModule = ItemsEanCodeMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_ean_code_master_controller_1.ItemsEanCodeMasterController],
        providers: [items_ean_code_master_service_1.ItemsEanCodeMasterService, item_ean_code_exception_filter_1.ItemEanCodeExceptionFilter],
        exports: [items_ean_code_master_service_1.ItemsEanCodeMasterService],
    })
], ItemsEanCodeMasterModule);
//# sourceMappingURL=items-ean-code-master.module.js.map