"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContextService = void 0;
const common_1 = require("@nestjs/common");
const node_async_hooks_1 = require("node:async_hooks");
let RequestContextService = class RequestContextService {
    asyncLocalStorage = new node_async_hooks_1.AsyncLocalStorage();
    run(store, callback) {
        return this.asyncLocalStorage.run(store, callback);
    }
    getIpAddress() {
        return this.asyncLocalStorage.getStore()?.ipAddress ?? null;
    }
    setUserId(userId) {
        const store = this.asyncLocalStorage.getStore();
        if (!store) {
            return;
        }
        store.userId = userId;
    }
    getUserId() {
        return this.asyncLocalStorage.getStore()?.userId ?? null;
    }
    setUserType(userType) {
        const store = this.asyncLocalStorage.getStore();
        if (!store) {
            return;
        }
        store.userType = userType;
    }
    getUserType() {
        return this.asyncLocalStorage.getStore()?.userType ?? null;
    }
    setCompanyId(companyId) {
        const store = this.asyncLocalStorage.getStore();
        if (!store) {
            return;
        }
        store.companyId = companyId;
    }
    getCompanyId() {
        return this.asyncLocalStorage.getStore()?.companyId ?? null;
    }
    setBranchId(branchId) {
        const store = this.asyncLocalStorage.getStore();
        if (!store) {
            return;
        }
        store.branchId = branchId;
    }
    getBranchId() {
        return this.asyncLocalStorage.getStore()?.branchId ?? null;
    }
    setDeviceId(deviceId) {
        const store = this.asyncLocalStorage.getStore();
        if (!store) {
            return;
        }
        store.deviceId = deviceId;
    }
    getDeviceId() {
        return this.asyncLocalStorage.getStore()?.deviceId ?? null;
    }
};
exports.RequestContextService = RequestContextService;
exports.RequestContextService = RequestContextService = __decorate([
    (0, common_1.Injectable)()
], RequestContextService);
//# sourceMappingURL=request-context.service.js.map