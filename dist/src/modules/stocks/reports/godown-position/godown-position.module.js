"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GodownPositionModule = void 0;
const common_1 = require("@nestjs/common");
const delivery_core_module_1 = require("../../../sales/delivery/core/delivery-core.module");
const godown_position_controller_1 = require("./godown-position.controller");
const godown_position_service_1 = require("./godown-position.service");
let GodownPositionModule = class GodownPositionModule {
};
exports.GodownPositionModule = GodownPositionModule;
exports.GodownPositionModule = GodownPositionModule = __decorate([
    (0, common_1.Module)({
        imports: [delivery_core_module_1.DeliveryCoreModule],
        controllers: [godown_position_controller_1.GodownPositionController],
        providers: [godown_position_service_1.GodownPositionService],
        exports: [godown_position_service_1.GodownPositionService],
    })
], GodownPositionModule);
//# sourceMappingURL=godown-position.module.js.map