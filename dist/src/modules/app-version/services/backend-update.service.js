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
exports.BackendUpdateService = void 0;
const common_1 = require("@nestjs/common");
const client_info_1 = require("../../../common/client-info/client-info");
const redis_cache_service_1 = require("../../../common/redis/redis-cache.service");
const auth_session_service_1 = require("../../auth/auth-session.service");
const backend_build_1 = require("../../health/backend-build");
const app_version_constants_1 = require("../app-version.constants");
const compat_manifest_1 = require("../compat/compat-manifest");
const release_list_1 = require("../compat/release-list");
const app_version_state_store_1 = require("./app-version-state.store");
const auth_epoch_service_1 = require("./auth-epoch.service");
const build_policy_service_1 = require("./build-policy.service");
let BackendUpdateService = class BackendUpdateService {
    store;
    epoch;
    policies;
    redis;
    logger = new common_1.Logger('BackendUpdate');
    timer = null;
    manifest = null;
    retry = null;
    ticking = false;
    constructor(store, epoch, policies, redis) {
        this.store = store;
        this.epoch = epoch;
        this.policies = policies;
        this.redis = redis;
    }
    async onApplicationBootstrap() {
        if (process.env.NODE_ENV === 'test') {
            this.logger.log('NODE_ENV=test: backend update step skipped (a test run never logs users out)');
        }
        else {
            await this.runStartupCheck();
        }
        await this.refresh();
        this.timer = setInterval(() => {
            void this.tick();
        }, app_version_constants_1.STATE_REFRESH_INTERVAL_MS);
        this.timer.unref();
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    bundledManifest() {
        return this.manifest;
    }
    async runStartupCheck(build = (0, backend_build_1.backendBuild)(), env = process.env) {
        if (build.build === null) {
            this.logger.warn('No backend build (APP_BUILD or build-info.json): no logout after an update, and the ' +
                'build policy is left as it is');
            return null;
        }
        if (build.build < 1 || build.build > client_info_1.MAX_CLIENT_BUILD) {
            this.logger.warn(`Backend build ${build.build} is not a build number 1..${client_info_1.MAX_CLIENT_BUILD}: no logout ` +
                'after an update, and the build policy is left as it is');
            return null;
        }
        const loaded = (0, compat_manifest_1.loadCompatManifest)(build.build, env);
        if (!loaded.ok) {
            this.logger.warn(`Compat manifest${loaded.path ? ` ${loaded.path}` : ''} not used (${loaded.reason}): ` +
                `no logout after an update, and the build policy is left as it is`);
            return null;
        }
        this.manifest = loaded.manifest;
        const releases = this.releasesToImport(env);
        let outcome;
        try {
            outcome = await this.store.applyBackendUpdate({
                build: build.build,
                version: build.version,
                commit: build.commit,
                manifest: loaded.manifest,
                releases,
                actor: app_version_constants_1.SYSTEM_UPDATE_ACTOR,
            }, () => this.tidySessions());
        }
        catch (error) {
            if (!this.retry) {
                this.logger.error(`Could not run the backend update step for build ${build.build}; retrying every ` +
                    `${app_version_constants_1.STATE_REFRESH_INTERVAL_MS / 1000} s: ${describe(error)}`);
            }
            this.retry = { build, env };
            return null;
        }
        if (this.retry) {
            this.retry = null;
            this.logger.log(`Backend update step for build ${build.build} went through on a retry`);
        }
        this.epoch.set(outcome.epoch);
        if (!outcome.bumped) {
            this.logger.log(`Build ${build.build} unchanged: token epoch ${outcome.epoch}, no logout`);
            return outcome;
        }
        this.logger.warn(`Backend build ${outcome.previousBuild ?? 'none'} -> ${build.build}: token epoch raised to ` +
            `${outcome.epoch}, every user must log in again. Build policy from ${loaded.manifest.path}: ` +
            `written ${outcome.policiesWritten.join(', ') || 'none'}` +
            (outcome.policiesKeptManual.length
                ? `; kept (manual) ${outcome.policiesKeptManual.join(', ')}`
                : '') +
            (outcome.policiesNoValue.length
                ? `; no value for ${outcome.policiesNoValue.join(', ')}`
                : '') +
            (outcome.releasesImported === null
                ? '. Release list not imported'
                : `. Release list: ${outcome.releasesImported} app_release row(s) added or changed`));
        return outcome;
    }
    releasesToImport(env) {
        if ((env.APP_RELEASES_IMPORT ?? '').trim().toLowerCase() === 'false') {
            this.logger.log('APP_RELEASES_IMPORT=false: releases.json is not imported here');
            return null;
        }
        const loaded = (0, release_list_1.loadReleaseList)(env);
        if (!loaded.ok) {
            this.logger.warn(`Release list${loaded.path ? ` ${loaded.path}` : ''} not imported (${loaded.reason}); ` +
                'app_release is left as it is');
            return null;
        }
        return loaded.list.releases;
    }
    async tick() {
        if (this.ticking) {
            return;
        }
        this.ticking = true;
        try {
            if (this.retry) {
                await this.runStartupCheck(this.retry.build, this.retry.env);
            }
            await this.refresh();
        }
        finally {
            this.ticking = false;
        }
    }
    async refresh() {
        await Promise.all([this.epoch.reload(), this.policies.reload()]);
    }
    async tidySessions() {
        try {
            const closed = await this.store.closeOpenLoginSessions(app_version_constants_1.SYSTEM_UPDATE_ACTOR);
            this.logger.log(`Closed ${closed} open login session row(s)`);
        }
        catch (error) {
            this.logger.warn(`Could not close the open login session rows: ${describe(error)}`);
        }
        if (!this.redis.isEnabled()) {
            return;
        }
        try {
            const keys = await this.redis.keys(`${auth_session_service_1.AUTH_SESSION_KEY_PREFIX}:*`);
            let removed = 0;
            for (let start = 0; start < keys.length; start += REDIS_DELETE_CHUNK) {
                removed += await this.redis.delMany(keys.slice(start, start + REDIS_DELETE_CHUNK));
            }
            this.logger.log(`Dropped ${removed} Redis session(s)`);
        }
        catch (error) {
            this.logger.warn(`Could not drop the Redis sessions: ${describe(error)}`);
        }
    }
};
exports.BackendUpdateService = BackendUpdateService;
exports.BackendUpdateService = BackendUpdateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_version_state_store_1.AppVersionStateStore,
        auth_epoch_service_1.AuthEpochService,
        build_policy_service_1.BuildPolicyService,
        redis_cache_service_1.RedisCacheService])
], BackendUpdateService);
const REDIS_DELETE_CHUNK = 500;
function describe(error) {
    return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
//# sourceMappingURL=backend-update.service.js.map