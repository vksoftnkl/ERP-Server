"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const gst_auth_service_1 = require("./client/gst-auth.service");
const gst_http_client_1 = require("./client/gst-http.client");
const gst_company_credential_service_1 = require("./config/gst-company-credential.service");
const gst_config_support_1 = require("./config/gst-config.support");
const gst_crypto_service_1 = require("./config/gst-crypto.service");
const gst_provider_account_service_1 = require("./config/gst-provider-account.service");
const gst_provider_parts_service_1 = require("./config/gst-provider-parts.service");
const gst_provider_service_1 = require("./config/gst-provider.service");
const gst_company_credential_controller_1 = require("./controllers/gst-company-credential.controller");
const gst_provider_account_controller_1 = require("./controllers/gst-provider-account.controller");
const gst_provider_parts_controllers_1 = require("./controllers/gst-provider-parts.controllers");
const gst_provider_controller_1 = require("./controllers/gst-provider.controller");
const gst_exception_filter_1 = require("./gst-exception.filter");
let GstModule = class GstModule {
};
exports.GstModule = GstModule;
exports.GstModule = GstModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [
            gst_provider_controller_1.GstProviderController,
            gst_provider_parts_controllers_1.GstProviderServiceController,
            gst_provider_parts_controllers_1.GstProviderEndpointController,
            gst_provider_parts_controllers_1.GstProviderFieldMapController,
            gst_provider_parts_controllers_1.GstProviderErrorMapController,
            gst_provider_account_controller_1.GstProviderAccountController,
            gst_company_credential_controller_1.GstCompanyCredentialController,
        ],
        providers: [
            gst_crypto_service_1.GstCryptoService,
            gst_config_support_1.GstConfigSupport,
            gst_provider_service_1.GstProviderService,
            gst_provider_parts_service_1.GstProviderPartsService,
            gst_provider_account_service_1.GstProviderAccountService,
            gst_company_credential_service_1.GstCompanyCredentialService,
            gst_http_client_1.GstHttpClient,
            gst_auth_service_1.GstAuthService,
            gst_exception_filter_1.GstExceptionFilter,
        ],
        exports: [gst_crypto_service_1.GstCryptoService, gst_auth_service_1.GstAuthService],
    })
], GstModule);
//# sourceMappingURL=gst.module.js.map