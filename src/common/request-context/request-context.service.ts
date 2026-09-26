import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
type RequestContextStore = {
  ipAddress: string | null;
  userId: string | null;
  userType: string | null;
  companyId: string | null;
  branchId: string | null;
  deviceId: string | null;
};
@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();
  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.asyncLocalStorage.run(store, callback);
  }
  getIpAddress(): string | null {
    return this.asyncLocalStorage.getStore()?.ipAddress ?? null;
  }
  setUserId(userId: string | null): void {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      return;
    }
    store.userId = userId;
  }
  getUserId(): string | null {
    return this.asyncLocalStorage.getStore()?.userId ?? null;
  }
  setUserType(userType: string | null): void {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      return;
    }
    store.userType = userType;
  }
  getUserType(): string | null {
    return this.asyncLocalStorage.getStore()?.userType ?? null;
  }
  setCompanyId(companyId: string | null): void {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      return;
    }
    store.companyId = companyId;
  }
  getCompanyId(): string | null {
    return this.asyncLocalStorage.getStore()?.companyId ?? null;
  }
  setBranchId(branchId: string | null): void {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      return;
    }
    store.branchId = branchId;
  }
  /** The branch of the counter this session logged in at, or null for none. */
  getBranchId(): string | null {
    return this.asyncLocalStorage.getStore()?.branchId ?? null;
  }
  setDeviceId(deviceId: string | null): void {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      return;
    }
    store.deviceId = deviceId;
  }
  /** A real `fixed.device_master.dev_id`, or null when this session is not a counter. */
  getDeviceId(): string | null {
    return this.asyncLocalStorage.getStore()?.deviceId ?? null;
  }
}
