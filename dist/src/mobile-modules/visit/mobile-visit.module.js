"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileVisitModule = void 0;
const common_1 = require("@nestjs/common");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_visit_controller_1 = require("./mobile-visit.controller");
const mobile_visit_service_1 = require("./mobile-visit.service");
let MobileVisitModule = class MobileVisitModule {
};
exports.MobileVisitModule = MobileVisitModule;
exports.MobileVisitModule = MobileVisitModule = __decorate([
    (0, common_1.Module)({
        controllers: [mobile_visit_controller_1.MobileVisitController],
        providers: [mobile_visit_service_1.MobileVisitService, mobile_exception_filter_1.MobileExceptionFilter],
    })
], MobileVisitModule);
//# sourceMappingURL=mobile-visit.module.js.map