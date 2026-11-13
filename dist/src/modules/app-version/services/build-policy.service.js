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
var BuildPolicyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildPolicyService = void 0;
const common_1 = require("@nestjs/common");
const client_info_1 = require("../../../common/client-info/client-info");
const app_version_error_codes_1 = require("../types/app-version-error-codes");
const update_required_exception_1 = require("../types/update-required.exception");
const app_version_state_store_1 = require("./app-version-state.store");
let BuildPolicyService = BuildPolicyService_1 = class BuildPolicyService {
    store;
    logger = new common_1.Logger(BuildPolicyService_1.name);
    policies = new Map();
    readFailed = false;
    inFlight = null;
    generation = 0;
    constructor(store) {
        this.store = store;
    }
    async reload() {
        this.inFlight ??= this.read().finally(() => {
            this.inFlight = null;
        });
        return this.inFlight;
    }
    list() {
        return client_info_1.CLIENT_PLATFORMS.map((platform) => this.policies.get(platform) ?? noPolicy(platform));
    }
    get(platform) {
        return this.policies.get(platform) ?? null;
    }
    assertClientBuild(platform, clientBuild) {
        if (platform === null) {
            return;
        }
        const policy = this.policies.get(platform);
        if (!policy || !policy.enforce || policy.expectedBuild === null) {
            return;
        }
        if (clientBuild === policy.expectedBuild) {
            return;
        }
        throw new update_required_exception_1.UpdateRequiredException({
            platform,
            clientBuild,
            expectedBuild: policy.expectedBuild,
            message: policy.message,
            downloadUrl: policy.downloadUrl,
        });
    }
    async update(platform, dto, actor) {
        const handSet = dto.expectedBuild !== undefined || dto.message !== undefined || dto.downloadUrl !== undefined;
        const saved = await this.store.writePolicy(platform, handSet ? 'manual' : null, actor, (current) => {
            const base = current ?? noPolicy(platform);
            const next = {
                enforce: dto.enforce ?? base.enforce,
                expectedBuild: dto.expectedBuild === undefined ? base.expectedBuild : dto.expectedBuild,
                message: dto.message === undefined ? base.message : dto.message,
                downloadUrl: dto.downloadUrl === undefined ? base.downloadUrl : dto.downloadUrl,
            };
            assertBuildForEnforce(platform, next);
            return next;
        });
        this.remember(saved);
        return saved;
    }
    async useManifest(platform, manifest, actor) {
        if (!manifest) {
            throw new common_1.ConflictException((0, app_version_error_codes_1.appVersionErrorBody)('This server has no valid compat manifest (APP_BUILD + compat-manifest.json); ' +
                'set the policy by hand instead', 'platform', app_version_error_codes_1.AppVersionErrorCode.POLICY_NO_MANIFEST));
        }
        const entry = manifest.clients[platform];
        const saved = await this.store.writePolicy(platform, 'manifest', actor, (current) => {
            const base = current ?? noPolicy(platform);
            const next = {
                enforce: base.enforce,
                expectedBuild: entry.expectedBuild ?? base.expectedBuild,
                message: entry.message ?? base.message,
                downloadUrl: entry.downloadUrl ?? base.downloadUrl,
            };
            assertBuildForEnforce(platform, next);
            return next;
        });
        this.remember(saved);
        return saved;
    }
    remember(policy) {
        this.generation += 1;
        const next = new Map(this.policies);
        next.set(policy.platform, policy);
        this.policies = next;
    }
    async read() {
        const generation = this.generation;
        try {
            const rows = await this.store.readPolicies();
            if (generation !== this.generation) {
                return;
            }
            this.policies = new Map(rows.map((row) => [row.platform, row]));
            if (this.readFailed) {
                this.readFailed = false;
                this.logger.log('Build policy: readable again');
            }
        }
        catch (error) {
            if (!this.readFailed) {
                this.readFailed = true;
                const message = error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
                this.logger.warn(`Build policy: could not read app_build_policy, keeping the last copy: ${message}`);
            }
        }
    }
};
exports.BuildPolicyService = BuildPolicyService;
exports.BuildPolicyService = BuildPolicyService = BuildPolicyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_version_state_store_1.AppVersionStateStore])
], BuildPolicyService);
function assertBuildForEnforce(platform, next) {
    if (next.enforce && next.expectedBuild === null) {
        throw new common_1.BadRequestException((0, app_version_error_codes_1.appVersionErrorBody)(`${platform}: enforce = true needs an expectedBuild`, 'expectedBuild', app_version_error_codes_1.AppVersionErrorCode.POLICY_BUILD_REQUIRED));
    }
}
function noPolicy(platform) {
    return {
        platform,
        enforce: false,
        expectedBuild: null,
        message: null,
        downloadUrl: null,
        source: 'manifest',
        changedOn: null,
        changedBy: null,
    };
}
//# sourceMappingURL=build-policy.service.js.map