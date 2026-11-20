"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const app_settings_module_1 = require("../settings/appSettings/app-settings.module");
const print_render_module_1 = require("../settings/print-render/print-render.module");
const wa_connection_controller_1 = require("./controllers/wa-connection.controller");
const wa_messages_controller_1 = require("./controllers/wa-messages.controller");
const wa_after_post_service_1 = require("./wa-after-post.service");
const wa_connection_service_1 = require("./wa-connection.service");
const wa_crypto_service_1 = require("./wa-crypto.service");
const wa_events_service_1 = require("./wa-events.service");
const wa_exception_filter_1 = require("./wa-exception.filter");
const wa_messages_service_1 = require("./wa-messages.service");
const wa_poller_service_1 = require("./wa-poller.service");
const wa_relay_client_1 = require("./wa-relay.client");
const wa_send_service_1 = require("./wa-send.service");
const wa_settings_service_1 = require("./wa-settings.service");
const wa_store_service_1 = require("./wa-store.service");
let WhatsappModule = class WhatsappModule {
};
exports.WhatsappModule = WhatsappModule;
exports.WhatsappModule = WhatsappModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, app_settings_module_1.AppSettingsModule, print_render_module_1.PrintRenderModule],
        controllers: [wa_connection_controller_1.WaConnectionController, wa_messages_controller_1.WaMessagesController],
        providers: [
            wa_store_service_1.WaStore,
            wa_crypto_service_1.WaCryptoService,
            wa_relay_client_1.WaRelayClient,
            wa_settings_service_1.WaSettingsService,
            wa_send_service_1.WaSendService,
            wa_events_service_1.WaEventsService,
            wa_connection_service_1.WaConnectionService,
            wa_messages_service_1.WaMessagesService,
            wa_after_post_service_1.WaAfterPostService,
            wa_poller_service_1.WaPollerService,
            wa_exception_filter_1.WaExceptionFilter,
        ],
    })
], WhatsappModule);
//# sourceMappingURL=whatsapp.module.js.map