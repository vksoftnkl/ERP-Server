"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HsnCodeMasterModule = void 0;
const common_1 = require("@nestjs/common");
const hsn_code_master_controller_1 = require("./hsn-code-master.controller");
const hsn_code_master_service_1 = require("./hsn-code-master.service");
let HsnCodeMasterModule = class HsnCodeMasterModule {
};
exports.HsnCodeMasterModule = HsnCodeMasterModule;
exports.HsnCodeMasterModule = HsnCodeMasterModule = __decorate([
    (0, common_1.Module)({
        controllers: [hsn_code_master_controller_1.HsnCodeMasterController],
        providers: [hsn_code_master_service_1.HsnCodeMasterService],
    })
], HsnCodeMasterModule);
//# sourceMappingURL=hsn-code-master.module.js.map