"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../common/posting/posting.module");
const stock_posting_module_1 = require("../stocks/posting/stock-posting.module");
const purchase_grn_1 = require("./grn/purchase-grn");
const purchase_invoice_controller_1 = require("./invoice/purchase-invoice.controller");
const purchase_invoice_service_1 = require("./invoice/purchase-invoice.service");
const purchase_order_1 = require("./order/purchase-order");
const purchase_return_1 = require("./return/purchase-return");
const purchase_shortage_1 = require("./shortage/purchase-shortage");
let PurchaseModule = class PurchaseModule {
};
exports.PurchaseModule = PurchaseModule;
exports.PurchaseModule = PurchaseModule = __decorate([
    (0, common_1.Module)({
        imports: [posting_module_1.CommonPostingModule, stock_posting_module_1.StockPostingModule],
        controllers: [purchase_invoice_controller_1.PurchaseInvoiceController, purchase_order_1.PurchaseOrderController, purchase_grn_1.PurchaseGrnController, purchase_return_1.PurchaseReturnController, purchase_shortage_1.PurchaseShortageController],
        providers: [purchase_invoice_service_1.PurchaseInvoiceService, purchase_order_1.PurchaseOrderService, purchase_grn_1.PurchaseGrnService, purchase_return_1.PurchaseReturnService, purchase_shortage_1.PurchaseShortageService],
    })
], PurchaseModule);
//# sourceMappingURL=purchase.module.js.map