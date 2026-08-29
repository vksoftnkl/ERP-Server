type RequestContextStore = {
    ipAddress: string | null;
    userId: string | null;
    userType: string | null;
    companyId: string | null;
    branchId: string | null;
    deviceId: string | null;
};
export declare class RequestContextService {
    private readonly asyncLocalStorage;
    run<T>(store: RequestContextStore, callback: () => T): T;
    getIpAddress(): string | null;
    setUserId(userId: string | null): void;
    getUserId(): string | null;
    setUserType(userType: string | null): void;
    getUserType(): string | null;
    setCompanyId(companyId: string | null): void;
    getCompanyId(): string | null;
    setBranchId(branchId: string | null): void;
    getBranchId(): string | null;
    setDeviceId(deviceId: string | null): void;
    getDeviceId(): string | null;
}
export {};
