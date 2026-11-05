"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsGstUnitsMasterModule = void 0;
const common_1 = require("@nestjs/common");
const item_gst_unit_exception_filter_1 = require("./item-gst-unit-exception.filter");
const items_gst_units_master_controller_1 = require("./items-gst-units-master.controller");
const items_gst_units_master_service_1 = require("./items-gst-units-master.service");
let ItemsGstUnitsMasterModule = class ItemsGstUnitsMasterModule {
};
exports.ItemsGstUnitsMasterModule = ItemsGstUnitsMasterModule;
exports.ItemsGstUnitsMasterModule = ItemsGstUnitsMasterModule = __decorate([
    (0, common_1.Module)({
        controllers: [items_gst_units_master_controller_1.ItemsGstUnitsMasterController],
        providers: [items_gst_units_master_service_1.ItemsGstUnitsMasterService, item_gst_unit_exception_filter_1.ItemGstUnitExceptionFilter],
    })
], ItemsGstUnitsMasterModule);
//# sourceMappingURL=items-gst-units-master.module.js.map