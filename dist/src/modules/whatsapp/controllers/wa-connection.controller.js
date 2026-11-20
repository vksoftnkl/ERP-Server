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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaConnectionController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const wa_dto_1 = require("../dto/wa.dto");
const wa_connection_service_1 = require("../wa-connection.service");
const wa_exception_filter_1 = require("../wa-exception.filter");
const wa_settings_service_1 = require("../wa-settings.service");
const wa_store_service_1 = require("../wa-store.service");
const wa_constants_1 = require("../wa.constants");
const ok = (message, data) => ({ success: true, message, data });
let WaConnectionController = class WaConnectionController {
    connection;
    settings;
    store;
    constructor(connection, settings, store) {
        this.connection = connection;
        this.settings = settings;
        this.store = store;
    }
    async get(q) {
        return ok('WhatsApp connection', await this.connection.get(q.companyId));
    }
    async activate(dto) {
        return ok('WhatsApp activated', await this.connection.activate(dto));
    }
    async connectStart(dto) {
        return ok('Open the link in the browser to connect the number', await this.connection.connectStart(dto));
    }
    async refresh(dto) {
        return ok('WhatsApp connection refreshed', await this.connection.refresh(dto));
    }
    async disconnect(dto) {
        return ok('WhatsApp disconnected', await this.connection.disconnect(dto));
    }
    async rotateKey(dto) {
        return ok('WhatsApp key rotated', await this.connection.rotateKey(dto));
    }
    async test(dto) {
        return ok('WhatsApp test sent', await this.connection.test(dto));
    }
    async settingsGet(q) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'view', 'open WhatsApp settings');
        return ok('WhatsApp settings', await this.settings.get(q.companyId));
    }
    async settingsSave(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'edit', 'change WhatsApp settings');
        this.store.assertMainServer();
        const { companyId, ...rest } = dto;
        return ok('WhatsApp settings saved', await this.settings.save(companyId, rest));
    }
};
exports.WaConnectionController = WaConnectionController;
__decorate([
    (0, common_1.Get)('connection/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The company\'s WhatsApp link (307 View): state NOT_ACTIVATED | ACTIVATED | CONNECTING | CONNECTED | DISCONNECTED | ' +
            'SUSPENDED, shop, key prefix, number, quality, limit, usedToday, last poll, relayReachable, templates[]. 403 WA_RIGHT_VIEW.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaCompanyDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('connection/activate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Activate with VK's code (307 Edit) → { state, shopCode, keyPrefix }. 404 LOOKUP_COMPANY_NOT_FOUND; 422 WA_ACTIVATION_INVALID; 409 WA_ALREADY_ACTIVATED " +
            '(send replace: true for a re-key code); 503 WA_KEY_MISSING / WA_RELAY_NOT_SET / WA_RELAY_UNREACHABLE; 409 WA_SITE_OFFLINE.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaActivateDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)('connection/connect-start'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'A 15-minute link to the Embedded Signup page (307 Edit) → { connectUrl, expiresAt }; state CONNECTING. ' +
            '409 WA_NOT_ACTIVATED / WA_ALREADY_CONNECTED / WA_SHOP_SUSPENDED / WA_KEY_REVOKED.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaCompanyDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "connectStart", null);
__decorate([
    (0, common_1.Post)('connection/refresh'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Pull the connection and events from the relay now (307 View); answers as /connection/get.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaCompanyDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('connection/disconnect'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Disconnect the number (307 Edit) → { state: DISCONNECTED }. 409 WA_NOT_CONNECTED.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaDisconnectDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Post)('connection/rotate-key'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A new relay key (307 Edit) → { keyPrefix, rotatedOn, oldKeyValidUntil }.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaCompanyDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "rotateKey", null);
__decorate([
    (0, common_1.Post)('connection/test'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Send hello_world to a number (307 View) → { wmlId, accYear, status, phone, phoneSource, templateName, lang, langNote, ' +
            'errorCode, errorText }. A relay / Meta failure is status FAILED with its code (200); 400 WA_BAD_NUMBER; 409 WA_NOT_CONNECTED.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaTestDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "test", null);
__decorate([
    (0, common_1.Get)('settings/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The whatsapp.* company settings + onPostTypes[{ vchrTypeId, vchrTypeName, vchrParentId, kind, templateName, on }] (307 View).',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaCompanyDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "settingsGet", null);
__decorate([
    (0, common_1.Post)('settings/save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save any of the settings and onPostTypes[{ vchrTypeId, on }] (307 Edit; the ticks are this company\'s ' +
            'whatsapp.on_post_types); answers as /settings/get. 400 WA_SETTING_INVALID (one per bad field, field = the key); ' +
            '409 WA_SITE_OFFLINE.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaSettingsSaveDto]),
    __metadata("design:returntype", Promise)
], WaConnectionController.prototype, "settingsSave", null);
exports.WaConnectionController = WaConnectionController = __decorate([
    (0, swagger_1.ApiTags)('WhatsApp'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('whatsapp'),
    (0, common_1.UseFilters)(wa_exception_filter_1.WaExceptionFilter),
    __metadata("design:paramtypes", [wa_connection_service_1.WaConnectionService,
        wa_settings_service_1.WaSettingsService,
        wa_store_service_1.WaStore])
], WaConnectionController);
//# sourceMappingURL=wa-connection.controller.js.map