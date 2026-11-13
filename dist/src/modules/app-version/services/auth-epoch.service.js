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
var AuthEpochService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthEpochService = void 0;
const common_1 = require("@nestjs/common");
const auth_error_codes_1 = require("../../auth/types/auth-error-codes");
const app_version_state_store_1 = require("./app-version-state.store");
let AuthEpochService = AuthEpochService_1 = class AuthEpochService {
    store;
    logger = new common_1.Logger(AuthEpochService_1.name);
    epoch = 0;
    readFailed = false;
    inFlight = null;
    generation = 0;
    lastEarlyReload = 0;
    constructor(store) {
        this.store = store;
    }
    current() {
        return this.epoch;
    }
    set(epoch) {
        this.generation += 1;
        this.epoch = epoch;
    }
    async reload() {
        this.inFlight ??= this.read().finally(() => {
            this.inFlight = null;
        });
        return this.inFlight;
    }
    assertTokenEpoch(ep, kind) {
        const tokenEpoch = typeof ep === 'number' && Number.isFinite(ep) ? ep : 0;
        if (tokenEpoch >= this.epoch) {
            const now = Date.now();
            if (tokenEpoch > this.epoch && now - this.lastEarlyReload >= EARLY_RELOAD_MIN_MS) {
                this.lastEarlyReload = now;
                void this.reload();
            }
            return;
        }
        throw new common_1.UnauthorizedException((0, auth_error_codes_1.authErrorBody)('The server was updated. Please log in again.', kind === 'access' ? 'authorization' : 'refresh_token', auth_error_codes_1.AuthErrorCode.BACKEND_UPDATED));
    }
    async read() {
        const generation = this.generation;
        try {
            const epoch = await this.store.readEpoch();
            if (generation !== this.generation) {
                return;
            }
            if (epoch !== this.epoch) {
                this.logger.log(`Token epoch ${this.epoch} -> ${epoch}`);
            }
            this.epoch = epoch;
            if (this.readFailed) {
                this.readFailed = false;
                this.logger.log('Token epoch: readable again');
            }
        }
        catch (error) {
            if (!this.readFailed) {
                this.readFailed = true;
                this.logger.warn(`Token epoch: could not read app_auth_state, keeping ${this.epoch}: ${describe(error)}`);
            }
        }
    }
};
exports.AuthEpochService = AuthEpochService;
exports.AuthEpochService = AuthEpochService = AuthEpochService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_version_state_store_1.AppVersionStateStore])
], AuthEpochService);
const EARLY_RELOAD_MIN_MS = 5_000;
function describe(error) {
    return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
//# sourceMappingURL=auth-epoch.service.js.map