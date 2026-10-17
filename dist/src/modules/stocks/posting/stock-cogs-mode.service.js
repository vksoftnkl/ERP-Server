"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockCogsModeService = void 0;
const common_1 = require("@nestjs/common");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
let StockCogsModeService = class StockCogsModeService {
    appSettings;
    constructor(appSettings) {
        this.appSettings = appSettings;
    }
    async cogsMode(companyId, branchId) {
        const effective = await this.appSettings.resolveEffective({
            companyId,
            branchId,
            deviceId: null,
            userId: null,
        });
        const value = (effective.find((i) => i.asdKey === 'accounts.cogs_mode')?.value ?? '')
            .trim()
            .toUpperCase();
        return value === 'PERIODIC' ? 'PERIODIC' : 'PERPETUAL';
    }
};
exports.StockCogsModeService = StockCogsModeService;
exports.StockCogsModeService = StockCogsModeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_setting_value_service_1.AppSettingValueService])
], StockCogsModeService);
//# sourceMappingURL=stock-cogs-mode.service.js.map