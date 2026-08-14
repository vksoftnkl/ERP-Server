"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitsMasterModule = void 0;
const common_1 = require("@nestjs/common");
const unit_exception_filter_1 = require("./unit-exception.filter");
const units_master_controller_1 = require("./units-master.controller");
const units_master_service_1 = require("./units-master.service");
let UnitsMasterModule = class UnitsMasterModule {
};
exports.UnitsMasterModule = UnitsMasterModule;
exports.UnitsMasterModule = UnitsMasterModule = __decorate([
    (0, common_1.Module)({
        controllers: [units_master_controller_1.UnitsMasterController],
        providers: [units_master_service_1.UnitsMasterService, unit_exception_filter_1.UnitExceptionFilter],
    })
], UnitsMasterModule);
//# sourceMappingURL=units-master.module.js.map