"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemSizeColourMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const item_attribute_exception_filter_1 = require("./item-attribute-exception.filter");
const item_colour_master_service_1 = require("./item-colour-master.service");
const item_colours_controller_1 = require("./item-colours.controller");
const item_size_master_service_1 = require("./item-size-master.service");
const item_sizes_controller_1 = require("./item-sizes.controller");
let ItemSizeColourMasterModule = class ItemSizeColourMasterModule {
};
exports.ItemSizeColourMasterModule = ItemSizeColourMasterModule;
exports.ItemSizeColourMasterModule = ItemSizeColourMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [item_sizes_controller_1.ItemSizesController, item_colours_controller_1.ItemColoursController],
        providers: [item_size_master_service_1.ItemSizeMasterService, item_colour_master_service_1.ItemColourMasterService, item_attribute_exception_filter_1.ItemAttributeExceptionFilter],
    })
], ItemSizeColourMasterModule);
//# sourceMappingURL=item-size-colour-master.module.js.map