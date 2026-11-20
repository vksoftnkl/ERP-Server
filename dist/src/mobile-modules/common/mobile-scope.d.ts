import { Prisma } from '@prisma/client';
export type MobileReadClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
export type MobileLockClient = MobileReadClient;
export interface MobileDevice {
    devId: string;
    devCode: string | null;
    devCompanyId: string | null;
    devBranchId: string | null;
}
export declare function assertMobileCompany(client: MobileReadClient, companyId: string, field?: string): Promise<{
    compId: string;
    compGstApplicable: boolean;
}>;
export declare function resolveMobileDevice(client: MobileReadClient, deviceUid: string, field?: string): Promise<MobileDevice>;
export declare function findMobileBranch(client: MobileReadClient, companyId: string, preferredBranchId: string | null): Promise<string | null>;
export declare function requireMobileBranch(client: MobileReadClient, companyId: string, preferredBranchId: string | null): Promise<string>;
export declare function requireMobileBranchOfCompany(client: MobileReadClient, companyId: string, branchId: string, field: string): Promise<string>;
export declare function databaseToday(client: MobileReadClient): Promise<string>;
export declare function requireMobileAccYear(client: MobileReadClient, companyId: string, onDate: string, field: string): Promise<string>;
export type MobileUploadKind = 'order' | 'visit' | 'bill' | 'receipt' | 'return';
export declare function lockMobileClientUuid(client: MobileLockClient, kind: MobileUploadKind, companyId: string, clientUuid: string): Promise<void>;
export declare function isClientUuidClash(error: unknown): boolean;
export declare function requireMobileLogin(userId: string | null | undefined): string;
