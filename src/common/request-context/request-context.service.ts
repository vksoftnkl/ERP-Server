import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
type RequestContextStore = {
  ipAddress: string | null;
  userId: string | null;
  userType: string | null;
  companyId: string | null;
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
}
