"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_version_controller_1 = require("./app-version.controller");
const app_version_admin_guard_1 = require("./guards/app-version-admin.guard");
const app_update_service_1 = require("./services/app-update.service");
const app_version_state_store_1 = require("./services/app-version-state.store");
const auth_epoch_service_1 = require("./services/auth-epoch.service");
const backend_update_service_1 = require("./services/backend-update.service");
const build_policy_service_1 = require("./services/build-policy.service");
const client_installation_service_1 = require("./services/client-installation.service");
const client_tracking_service_1 = require("./services/client-tracking.service");
const legacy_usage_service_1 = require("./services/legacy-usage.service");
let AppVersionModule = class AppVersionModule {
};
exports.AppVersionModule = AppVersionModule;
exports.AppVersionModule = AppVersionModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [app_version_controller_1.AppVersionController],
        providers: [
            app_update_service_1.AppUpdateService,
            client_installation_service_1.ClientInstallationService,
            legacy_usage_service_1.LegacyUsageService,
            client_tracking_service_1.ClientTrackingService,
            app_version_state_store_1.AppVersionStateStore,
            auth_epoch_service_1.AuthEpochService,
            build_policy_service_1.BuildPolicyService,
            backend_update_service_1.BackendUpdateService,
            app_version_admin_guard_1.AppVersionAdminGuard,
        ],
        exports: [client_tracking_service_1.ClientTrackingService, legacy_usage_service_1.LegacyUsageService, auth_epoch_service_1.AuthEpochService, build_policy_service_1.BuildPolicyService],
    })
], AppVersionModule);
//# sourceMappingURL=app-version.module.js.map