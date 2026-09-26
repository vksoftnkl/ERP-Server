"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsCategoryMasterModule = void 0;
const common_1 = require("@nestjs/common");
const item_category_exception_filter_1 = require("./item-category-exception.filter");
const items_category_master_controller_1 = require("./items-category-master.controller");
const items_category_master_service_1 = require("./items-category-master.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let ItemsCategoryMasterModule = class ItemsCategoryMasterModule {
};
exports.ItemsCategoryMasterModule = ItemsCategoryMasterModule;
exports.ItemsCategoryMasterModule = ItemsCategoryMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_category_master_controller_1.ItemsCategoryMasterController],
        providers: [items_category_master_service_1.ItemsCategoryMasterService, item_category_exception_filter_1.ItemCategoryExceptionFilter],
    })
], ItemsCategoryMasterModule);
//# sourceMappingURL=items-category-master.module.js.map