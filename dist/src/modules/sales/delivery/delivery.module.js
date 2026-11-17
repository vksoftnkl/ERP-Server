"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const posting_module_1 = require("../posting/posting.module");
const delivery_core_module_1 = require("./core/delivery-core.module");
const deliveries_controller_1 = require("./deliveries.controller");
const deliveries_service_1 = require("./deliveries.service");
const delivery_exception_filter_1 = require("./delivery-exception.filter");
const delivery_note_read_service_1 = require("./delivery-note-read.service");
const delivery_note_service_1 = require("./delivery-note.service");
const delivery_notes_controller_1 = require("./delivery-notes.controller");
const delivery_stock_correction_service_1 = require("./delivery-stock-correction.service");
let DeliveryModule = class DeliveryModule {
};
exports.DeliveryModule = DeliveryModule;
exports.DeliveryModule = DeliveryModule = __decorate([
    (0, common_1.Module)({
        imports: [delivery_core_module_1.DeliveryCoreModule, posting_module_1.SalesPostingModule, audit_log_module_1.AuditLogModule],
        controllers: [delivery_notes_controller_1.DeliveryNotesController, deliveries_controller_1.DeliveriesController],
        providers: [
            delivery_note_service_1.DeliveryNoteService,
            delivery_note_read_service_1.DeliveryNoteReadService,
            deliveries_service_1.DeliveriesService,
            delivery_stock_correction_service_1.DeliveryStockCorrectionService,
            delivery_exception_filter_1.DeliveryExceptionFilter,
        ],
        exports: [delivery_note_read_service_1.DeliveryNoteReadService],
    })
], DeliveryModule);
//# sourceMappingURL=delivery.module.js.map