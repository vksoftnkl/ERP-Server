"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemUnitConversionModule = void 0;
const common_1 = require("@nestjs/common");
const item_unit_conversion_exception_filter_1 = require("./item-unit-conversion-exception.filter");
const item_unit_conversion_controller_1 = require("./item-unit-conversion.controller");
const item_unit_conversion_service_1 = require("./item-unit-conversion.service");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let ItemUnitConversionModule = class ItemUnitConversionModule {
};
exports.ItemUnitConversionModule = ItemUnitConversionModule;
exports.ItemUnitConversionModule = ItemUnitConversionModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [item_unit_conversion_controller_1.ItemUnitConversionController],
        providers: [item_unit_conversion_service_1.ItemUnitConversionService, item_unit_conversion_exception_filter_1.ItemUnitConversionExceptionFilter],
        exports: [item_unit_conversion_service_1.ItemUnitConversionService],
    })
], ItemUnitConversionModule);
//# sourceMappingURL=item-unit-conversion.module.js.map