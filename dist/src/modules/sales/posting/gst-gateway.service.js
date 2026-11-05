"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GstGatewayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstGatewayService = void 0;
const common_1 = require("@nestjs/common");
const posting_types_1 = require("./types/posting.types");
const sales_errors_1 = require("./sales.errors");
let GstGatewayService = GstGatewayService_1 = class GstGatewayService {
    logger = new common_1.Logger(GstGatewayService_1.name);
    configured = false;
    cancelIrn(req) {
        this.logger.warn(`IRN cancel requested for register ${req.gdrId} but no GST gateway is configured`);
        (0, sales_errors_1.throwSalesLocked)('This document has a live IRN and the e-invoice service is not configured to cancel it — cancel the IRN at the portal first', posting_types_1.SALES_ERROR_CODES.IRN_CANCEL_FAILED, 'posting.irn');
    }
    cancelEwb(req) {
        this.logger.warn(`EWB cancel requested for register ${req.gdrId} but no GST gateway is configured`);
        (0, sales_errors_1.throwSalesLocked)('This document has a live e-way bill and the e-way bill service is not configured to cancel it — cancel it at the portal first', posting_types_1.SALES_ERROR_CODES.EWB_WINDOW_PASSED, 'posting.ewb');
    }
    enqueueAfterPost(doc) {
        if (!doc.gdrId || (!doc.einvoice && !doc.ewaybill)) {
            return;
        }
        this.logger.log(`GST generation pending for register ${doc.gdrId} (e-invoice ${doc.einvoice}, e-way bill ${doc.ewaybill}); no gateway configured`);
    }
};
exports.GstGatewayService = GstGatewayService;
exports.GstGatewayService = GstGatewayService = GstGatewayService_1 = __decorate([
    (0, common_1.Injectable)()
], GstGatewayService);
//# sourceMappingURL=gst-gateway.service.js.map