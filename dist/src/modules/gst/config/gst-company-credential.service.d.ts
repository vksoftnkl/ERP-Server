import { PrismaService } from "../../../database/prisma/prisma.service";
import { GstConfigSupport } from './gst-config.support';
import { SaveGstCompanyCredentialDto } from '../dto/save-gst-company-credential.dto';
import { GstAuthService } from '../client/gst-auth.service';
import type { GstCompanyCredentialPayload, GstCredentialStatus, GstCredentialVerifyResult } from '../types/gst-config.types';
export declare class GstCompanyCredentialService {
    private readonly prisma;
    private readonly support;
    private readonly auth;
    constructor(prisma: PrismaService, support: GstConfigSupport, auth: GstAuthService);
    getById(gccId: string): Promise<GstCompanyCredentialPayload>;
    save(dto: SaveGstCompanyCredentialDto): Promise<GstCompanyCredentialPayload>;
    softDelete(gccId: string): Promise<{
        gccId: string;
        deleted: boolean;
    }>;
    restore(gccId: string): Promise<{
        gccId: string;
        deleted: boolean;
    }>;
    verify(gccId: string): Promise<GstCredentialVerifyResult>;
    status(gccId: string): Promise<GstCredentialStatus>;
    private loadOrThrow;
    private assertGstinResolves;
    private liveProvider;
    private assertSlotIsFree;
    private translateSlotError;
    private retireSessions;
    private displayName;
    private toPayload;
}
