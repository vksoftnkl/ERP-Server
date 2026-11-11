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
exports.AppVersionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_info_1 = require("../../common/client-info/client-info");
const api_version_1 = require("../../common/constants/api-version");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const build_policy_dto_1 = require("./dto/build-policy.dto");
const check_update_dto_1 = require("./dto/check-update.dto");
const release_dto_1 = require("./dto/release.dto");
const support_query_dto_1 = require("./dto/support-query.dto");
const app_version_admin_guard_1 = require("./guards/app-version-admin.guard");
const app_update_service_1 = require("./services/app-update.service");
const backend_update_service_1 = require("./services/backend-update.service");
const build_policy_service_1 = require("./services/build-policy.service");
const client_installation_service_1 = require("./services/client-installation.service");
const legacy_usage_service_1 = require("./services/legacy-usage.service");
const app_version_error_codes_1 = require("./types/app-version-error-codes");
const AdminRoute = () => (0, common_1.applyDecorators)((0, common_1.UseGuards)(app_version_admin_guard_1.AppVersionAdminGuard), (0, swagger_1.ApiBearerAuth)('access-token'), (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No or a dead token' }), (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'APP_VERSION_ADMIN_ONLY' }));
const ReleaseRoute = () => (0, common_1.applyDecorators)(AdminRoute(), (0, app_version_admin_guard_1.ReleaseAccess)());
let AppVersionController = class AppVersionController {
    updates;
    installations;
    legacyUsage;
    policies;
    backendUpdate;
    constructor(updates, installations, legacyUsage, policies, backendUpdate) {
        this.updates = updates;
        this.installations = installations;
        this.legacyUsage = legacyUsage;
        this.policies = policies;
        this.backendUpdate = backendUpdate;
    }
    check(query, request) {
        const client = (0, client_info_1.clientInfoOf)(request);
        const platform = query.platform ?? client.platform;
        const build = query.build ?? client.build;
        if (!platform) {
            throw new common_1.BadRequestException((0, app_version_error_codes_1.appVersionErrorBody)('platform is required (?platform= or the X-App-Platform header)', 'platform', app_version_error_codes_1.AppVersionErrorCode.PLATFORM_REQUIRED));
        }
        if (build === null || build === undefined) {
            throw new common_1.BadRequestException((0, app_version_error_codes_1.appVersionErrorBody)('build is required (?build= or the X-App-Build header)', 'build', app_version_error_codes_1.AppVersionErrorCode.BUILD_REQUIRED));
        }
        return this.updates.check(platform, build);
    }
    createRelease(dto, request) {
        return this.updates.createRelease(dto, (0, app_version_admin_guard_1.actorOf)(request));
    }
    updateRelease(params, dto, request) {
        return this.updates.updateRelease(params.platform, params.build, dto, (0, app_version_admin_guard_1.actorOf)(request));
    }
    listReleases(query) {
        return this.updates.listReleases(query.platform, query.includeDeleted === true);
    }
    listInstallations(query) {
        return this.installations.list(query);
    }
    installationSummary(query) {
        return this.installations.summary(query);
    }
    legacyUsageList(query) {
        return this.legacyUsage.list(query);
    }
    listPolicies() {
        return this.policies.list().map(toPolicyResponse);
    }
    async updatePolicy(params, dto, request) {
        return toPolicyResponse(await this.policies.update(params.platform, dto, (0, app_version_admin_guard_1.actorOf)(request)));
    }
    async usePolicyManifest(params, request) {
        return toPolicyResponse(await this.policies.useManifest(params.platform, this.backendUpdate.bundledManifest(), (0, app_version_admin_guard_1.actorOf)(request)));
    }
};
exports.AppVersionController = AppVersionController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Is a newer build available? (public, read-only)',
        description: 'platform and build come from the query, else from the X-App-Platform / X-App-Build headers.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: check_update_dto_1.AppUpdateInfoDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [check_update_dto_1.CheckUpdateQueryDto, Object]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "check", null);
__decorate([
    (0, common_1.Post)('releases'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    ReleaseRoute(),
    (0, swagger_1.ApiOperation)({
        summary: 'Register a released build (CI user or admin); setExpected also makes it the expected build',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: release_dto_1.ReleaseResponseDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'APP_RELEASE_BUILD_EXISTS | APP_RELEASE_BUILD_TOO_LOW',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [release_dto_1.CreateReleaseDto, Object]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "createRelease", null);
__decorate([
    (0, common_1.Patch)('releases/:platform/:build'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({ summary: 'Change a release: severity, notes, link; isDeleted:true yanks it' }),
    (0, swagger_1.ApiOkResponse)({ type: release_dto_1.ReleaseResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'APP_RELEASE_NOT_FOUND' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [release_dto_1.ReleaseKeyParamsDto,
        release_dto_1.UpdateReleaseDto, Object]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "updateRelease", null);
__decorate([
    (0, common_1.Get)('releases'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    ReleaseRoute(),
    (0, swagger_1.ApiOperation)({
        summary: 'Live releases, newest build first; includeDeleted=true adds yanked ones (CI)',
    }),
    (0, swagger_1.ApiOkResponse)({ type: release_dto_1.ReleaseResponseDto, isArray: true }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [release_dto_1.ListReleasesQueryDto]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "listReleases", null);
__decorate([
    (0, common_1.Get)('installations'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({ summary: 'Which user / device runs which build, last seen first (support)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [support_query_dto_1.ListInstallationsQueryDto]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "listInstallations", null);
__decorate([
    (0, common_1.Get)('installations/summary'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({
        summary: 'Per platform: builds in use, the oldest active build, how many are behind (support)',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [support_query_dto_1.InstallationSummaryQueryDto]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "installationSummary", null);
__decorate([
    (0, common_1.Get)('legacy-usage'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({ summary: 'How often each legacy field is still used, per build (support)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [support_query_dto_1.LegacyUsageQueryDto]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "legacyUsageList", null);
__decorate([
    (0, common_1.Get)('policy'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({ summary: 'The build policy of every platform (Rev 2 §5.4)' }),
    (0, swagger_1.ApiOkResponse)({ type: build_policy_dto_1.BuildPolicyResponseDto, isArray: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], AppVersionController.prototype, "listPolicies", null);
__decorate([
    (0, common_1.Patch)('policy/:platform'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({
        summary: "Change a platform's build policy; the row becomes manual (enforce:false = emergency switch)",
    }),
    (0, swagger_1.ApiOkResponse)({ type: build_policy_dto_1.BuildPolicyResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'APP_POLICY_BUILD_REQUIRED' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [build_policy_dto_1.PolicyPlatformParamsDto,
        build_policy_dto_1.UpdateBuildPolicyDto, Object]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "updatePolicy", null);
__decorate([
    (0, common_1.Post)('policy/:platform/use-manifest'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    AdminRoute(),
    (0, swagger_1.ApiOperation)({
        summary: 'Hand a platform back to the bundled compat manifest (its values, source manifest)',
    }),
    (0, swagger_1.ApiOkResponse)({ type: build_policy_dto_1.BuildPolicyResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'APP_POLICY_NO_MANIFEST' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [build_policy_dto_1.PolicyPlatformParamsDto, Object]),
    __metadata("design:returntype", Promise)
], AppVersionController.prototype, "usePolicyManifest", null);
exports.AppVersionController = AppVersionController = __decorate([
    (0, swagger_1.ApiTags)('App Version'),
    (0, common_1.Controller)('app-version'),
    __metadata("design:paramtypes", [app_update_service_1.AppUpdateService,
        client_installation_service_1.ClientInstallationService,
        legacy_usage_service_1.LegacyUsageService,
        build_policy_service_1.BuildPolicyService,
        backend_update_service_1.BackendUpdateService])
], AppVersionController);
function toPolicyResponse(policy) {
    return {
        platform: policy.platform,
        enforce: policy.enforce,
        expectedBuild: policy.expectedBuild,
        message: policy.message,
        downloadUrl: policy.downloadUrl,
        source: policy.source,
        changedOn: policy.changedOn ? policy.changedOn.toISOString() : null,
        changedBy: policy.changedBy,
    };
}
//# sourceMappingURL=app-version.controller.js.map