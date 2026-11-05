"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterLookupModule = void 0;
const common_1 = require("@nestjs/common");
const bill_balance_module_1 = require("../accountsModule/billBalance/bill-balance.module");
const master_lookup_controller_1 = require("./master-lookup.controller");
const master_lookup_service_1 = require("./master-lookup.service");
let MasterLookupModule = class MasterLookupModule {
};
exports.MasterLookupModule = MasterLookupModule;
exports.MasterLookupModule = MasterLookupModule = __decorate([
    (0, common_1.Module)({
        imports: [bill_balance_module_1.BillBalanceModule],
        controllers: [master_lookup_controller_1.MasterLookupController],
        providers: [master_lookup_service_1.MasterLookupService],
    })
], MasterLookupModule);
//# sourceMappingURL=master-lookup.module.js.map