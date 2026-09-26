"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetMasterModule = void 0;
const common_1 = require("@nestjs/common");
const widget_master_controller_1 = require("./widget-master.controller");
const widget_master_exception_filter_1 = require("./widget-master-exception.filter");
const widget_master_service_1 = require("./widget-master.service");
let WidgetMasterModule = class WidgetMasterModule {
};
exports.WidgetMasterModule = WidgetMasterModule;
exports.WidgetMasterModule = WidgetMasterModule = __decorate([
    (0, common_1.Module)({
        controllers: [widget_master_controller_1.WidgetMasterController],
        providers: [widget_master_service_1.WidgetMasterService, widget_master_exception_filter_1.WidgetMasterExceptionFilter],
    })
], WidgetMasterModule);
//# sourceMappingURL=widget-master.module.js.map