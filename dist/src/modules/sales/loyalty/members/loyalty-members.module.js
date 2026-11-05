"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyMembersModule = void 0;
const common_1 = require("@nestjs/common");
const posting_module_1 = require("../../posting/posting.module");
const loyalty_members_controller_1 = require("./loyalty-members.controller");
const loyalty_members_service_1 = require("./loyalty-members.service");
let LoyaltyMembersModule = class LoyaltyMembersModule {
};
exports.LoyaltyMembersModule = LoyaltyMembersModule;
exports.LoyaltyMembersModule = LoyaltyMembersModule = __decorate([
    (0, common_1.Module)({
        imports: [posting_module_1.SalesPostingModule],
        controllers: [loyalty_members_controller_1.LoyaltyMembersController],
        providers: [loyalty_members_service_1.LoyaltyMembersService],
    })
], LoyaltyMembersModule);
//# sourceMappingURL=loyalty-members.module.js.map