"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesPostingModule = void 0;
const common_1 = require("@nestjs/common");
const stock_posting_module_1 = require("../../stocks/posting/stock-posting.module");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const charge_carry_service_1 = require("./charge-carry.service");
const dc_fulfilment_service_1 = require("./dc-fulfilment.service");
const doc_register_service_1 = require("./doc-register.service");
const gst_gateway_service_1 = require("./gst-gateway.service");
const loyalty_ledger_service_1 = require("./loyalty-ledger.service");
const promotion_usage_service_1 = require("./promotion-usage.service");
const sales_context_service_1 = require("./sales-context.service");
const sales_doc_blocks_service_1 = require("./sales-doc-blocks.service");
const sales_posting_service_1 = require("./sales-posting.service");
const sales_stock_service_1 = require("./sales-stock.service");
const stock_reservation_service_1 = require("./stock-reservation.service");
const statutory_service_1 = require("./statutory.service");
const transport_band_service_1 = require("./transport-band.service");
const SERVICES = [
    statutory_service_1.StatutoryService,
    loyalty_ledger_service_1.LoyaltyLedgerService,
    promotion_usage_service_1.PromotionUsageService,
    charge_carry_service_1.ChargeCarryService,
    sales_posting_service_1.SalesPostingService,
    doc_register_service_1.DocRegisterService,
    sales_context_service_1.SalesContextService,
    sales_doc_blocks_service_1.SalesDocBlocksService,
    transport_band_service_1.TransportBandService,
    sales_stock_service_1.SalesStockService,
    stock_reservation_service_1.StockReservationService,
    dc_fulfilment_service_1.DcFulfilmentService,
    gst_gateway_service_1.GstGatewayService,
];
let SalesPostingModule = class SalesPostingModule {
};
exports.SalesPostingModule = SalesPostingModule;
exports.SalesPostingModule = SalesPostingModule = __decorate([
    (0, common_1.Module)({
        imports: [stock_posting_module_1.StockPostingModule, app_settings_module_1.AppSettingsModule],
        providers: SERVICES,
        exports: [...SERVICES, stock_posting_module_1.StockPostingModule],
    })
], SalesPostingModule);
//# sourceMappingURL=posting.module.js.map