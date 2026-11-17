"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryCoreModule = void 0;
const common_1 = require("@nestjs/common");
const delivery_pending_service_1 = require("./delivery-pending.service");
const delivery_status_service_1 = require("./delivery-status.service");
let DeliveryCoreModule = class DeliveryCoreModule {
};
exports.DeliveryCoreModule = DeliveryCoreModule;
exports.DeliveryCoreModule = DeliveryCoreModule = __decorate([
    (0, common_1.Module)({
        providers: [delivery_pending_service_1.DeliveryPendingService, delivery_status_service_1.DeliveryStatusService],
        exports: [delivery_pending_service_1.DeliveryPendingService, delivery_status_service_1.DeliveryStatusService],
    })
], DeliveryCoreModule);
//# sourceMappingURL=delivery-core.module.js.map