"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptModule = void 0;
const common_1 = require("@nestjs/common");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const tender_detail_module_1 = require("../tenderDetail/tender-detail.module");
const bill_balance_module_1 = require("../billBalance/bill-balance.module");
const receipt_controller_1 = require("./receipt.controller");
const receipt_exception_filter_1 = require("./receipt-exception.filter");
const receipt_service_1 = require("./receipt.service");
const receipt_posting_service_1 = require("./receipt-posting.service");
const receipt_cancel_service_1 = require("./receipt-cancel.service");
const receipt_amend_service_1 = require("./receipt-amend.service");
const open_items_service_1 = require("./open-items.service");
let ReceiptModule = class ReceiptModule {
};
exports.ReceiptModule = ReceiptModule;
exports.ReceiptModule = ReceiptModule = __decorate([
    (0, common_1.Module)({
        imports: [app_settings_module_1.AppSettingsModule, tender_detail_module_1.TenderDetailModule, bill_balance_module_1.BillBalanceModule, audit_log_module_1.AuditLogModule],
        controllers: [receipt_controller_1.ReceiptController],
        providers: [
            receipt_service_1.ReceiptService,
            receipt_posting_service_1.ReceiptPostingService,
            receipt_cancel_service_1.ReceiptCancelService,
            receipt_amend_service_1.ReceiptAmendService,
            open_items_service_1.OpenItemsService,
            receipt_exception_filter_1.ReceiptExceptionFilter,
        ],
        exports: [open_items_service_1.OpenItemsService],
    })
], ReceiptModule);
//# sourceMappingURL=receipt.module.js.map