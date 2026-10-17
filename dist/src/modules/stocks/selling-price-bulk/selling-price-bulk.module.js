"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellingPriceBulkModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const selling_price_bulk_controller_1 = require("./selling-price-bulk.controller");
const selling_price_bulk_exception_filter_1 = require("./selling-price-bulk-exception.filter");
const selling_price_bulk_service_1 = require("./selling-price-bulk.service");
const price_bucket_gateway_1 = require("./price-bucket.gateway");
let SellingPriceBulkModule = class SellingPriceBulkModule {
};
exports.SellingPriceBulkModule = SellingPriceBulkModule;
exports.SellingPriceBulkModule = SellingPriceBulkModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, app_settings_module_1.AppSettingsModule],
        controllers: [selling_price_bulk_controller_1.SellingPriceBulkController],
        providers: [selling_price_bulk_service_1.SellingPriceBulkService, selling_price_bulk_exception_filter_1.SellingPriceBulkExceptionFilter, price_bucket_gateway_1.PriceBucketGateway],
        exports: [selling_price_bulk_service_1.SellingPriceBulkService, price_bucket_gateway_1.PriceBucketGateway],
    })
], SellingPriceBulkModule);
//# sourceMappingURL=selling-price-bulk.module.js.map