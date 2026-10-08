"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsMasterModule = void 0;
const common_1 = require("@nestjs/common");
const item_exception_filter_1 = require("./item-exception.filter");
const items_master_controller_1 = require("./items-master.controller");
const items_master_service_1 = require("./items-master.service");
const item_master_update_service_1 = require("./item-master-update.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const item_unit_conversion_module_1 = require("../item-unit-conversion/item-unit-conversion.module");
const items_price_master_module_1 = require("../items-price-master/items-price-master.module");
const items_ean_code_master_module_1 = require("../items-ean-code-master/items-ean-code-master.module");
const items_reorder_master_module_1 = require("../items-reorder-master/items-reorder-master.module");
const stock_track_policy_module_1 = require("../../stocks/stock-track-policy/stock-track-policy.module");
let ItemsMasterModule = class ItemsMasterModule {
};
exports.ItemsMasterModule = ItemsMasterModule;
exports.ItemsMasterModule = ItemsMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [
            audit_log_module_1.AuditLogModule,
            item_unit_conversion_module_1.ItemUnitConversionModule,
            items_price_master_module_1.ItemsPriceMasterModule,
            items_ean_code_master_module_1.ItemsEanCodeMasterModule,
            items_reorder_master_module_1.ItemsReorderMasterModule,
            stock_track_policy_module_1.StockTrackPolicyModule,
        ],
        controllers: [items_master_controller_1.ItemsMasterController],
        providers: [items_master_service_1.ItemsMasterService, item_master_update_service_1.ItemMasterUpdateService, item_exception_filter_1.ItemExceptionFilter],
    })
], ItemsMasterModule);
//# sourceMappingURL=items-master.module.js.map