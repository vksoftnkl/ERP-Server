import { PrismaService } from "../../../database/prisma/prisma.service";
import { GstCryptoService } from '../config/gst-crypto.service';
import { GstHttpClient } from './gst-http.client';
export declare const VERIFY_AUTH_BUDGET = 4;
export interface GstSignInOutcome {
    ok: boolean;
    message: string;
    errorCode?: string;
    tokenValidUntil?: string;
    creditBalance: number | null;
}
export declare class GstAuthService {
    private readonly prisma;
    private readonly crypto;
    private readonly http;
    private readonly logger;
    constructor(prisma: PrismaService, crypto: GstCryptoService, http: GstHttpClient);
    signIn(gccId: string, actor: string): Promise<GstSignInOutcome>;
    private resolveContext;
    private buildRequest;
    private publicKeyOf;
    private assertBudget;
    private interpret;
    private sessionFrom;
    private finish;
    private log;
    private redactResponse;
    private redactList;
    private at;
    private text;
    private missingHint;
    private incomplete;
}
export declare function parseProviderDateTime(raw: string, transform: string): Date | null;
export declare function istAccYear(at: Date): string;
