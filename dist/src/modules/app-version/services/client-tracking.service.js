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
var ClientTrackingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientTrackingService = void 0;
const common_1 = require("@nestjs/common");
const client_info_1 = require("../../../common/client-info/client-info");
const app_update_service_1 = require("./app-update.service");
const client_installation_service_1 = require("./client-installation.service");
const legacy_usage_service_1 = require("./legacy-usage.service");
let ClientTrackingService = ClientTrackingService_1 = class ClientTrackingService {
    installations;
    updates;
    legacyUsage;
    logger = new common_1.Logger(ClientTrackingService_1.name);
    constructor(installations, updates, legacyUsage) {
        this.installations = installations;
        this.updates = updates;
        this.legacyUsage = legacyUsage;
    }
    async onLogin(context) {
        try {
            const { client } = context;
            if (!(0, client_info_1.hasClientBuild)(client)) {
                return null;
            }
            const sighting = { ...context, client, actor: context.userName };
            const [, update] = await Promise.all([
                this.guard('record the login installation', () => this.installations.recordLogin(sighting)),
                this.guard('check for an update', () => this.updates.check(client.platform, client.build)),
            ]);
            return update;
        }
        catch (error) {
            this.warn('track the login', error);
            return null;
        }
    }
    async onRefresh(context) {
        try {
            const { client } = context;
            if (!(0, client_info_1.hasClientBuild)(client)) {
                return;
            }
            await this.guard('record the refresh installation', () => this.installations.recordRefresh({ ...context, client, actor: context.userName }));
        }
        catch (error) {
            this.warn('track the refresh', error);
        }
    }
    legacyField(name, client) {
        this.legacyUsage.record(name, client);
    }
    async guard(what, work) {
        try {
            return await work();
        }
        catch (error) {
            this.warn(what, error);
            return null;
        }
    }
    warn(what, error) {
        const message = error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
        this.logger.warn(`App version: could not ${what} (the request goes on): ${message}`);
    }
};
exports.ClientTrackingService = ClientTrackingService;
exports.ClientTrackingService = ClientTrackingService = ClientTrackingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_installation_service_1.ClientInstallationService,
        app_update_service_1.AppUpdateService,
        legacy_usage_service_1.LegacyUsageService])
], ClientTrackingService);
//# sourceMappingURL=client-tracking.service.js.map