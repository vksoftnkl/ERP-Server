import { GstProviderAccount, Prisma } from '@prisma/client';
import type { PrismaService } from "../../../database/prisma/prisma.service";
type Client = Prisma.TransactionClient | PrismaService;
export declare function resolveProviderAccount(client: Client, credential: {
    gccGpvId: string;
    gccEnvironment: string;
    gccService: string | null;
}, service?: string | null, options?: {
    activeOnly: boolean;
}): Promise<GstProviderAccount | null>;
export interface GstLease {
    gasId: string;
    tokenVersion: number;
    holder: string;
}
export declare function claimLease(prisma: PrismaService, params: {
    gccId: string;
    holder: string;
    leaseSeconds: number;
    keyVersion: number;
    actor: string;
}): Promise<GstLease | null>;
export declare function releaseLease(client: Client, lease: GstLease): Promise<void>;
export interface GstNewSession {
    authTokenEnc: string;
    sessionKeyEnc: string | null;
    refreshTokenEnc: string | null;
    keyVersion: number;
    issuedOn: Date;
    expiresOn: Date;
    expiryRaw: string | null;
    actor: string;
}
export declare function storeSession(tx: Prisma.TransactionClient, lease: GstLease, gccId: string, session: GstNewSession): Promise<boolean>;
export {};
