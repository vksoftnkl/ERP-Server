import { PrismaService } from "../../../database/prisma/prisma.service";
import { GstConfigSupport } from './gst-config.support';
import { SaveGstProviderAccountDto } from '../dto/save-gst-provider-account.dto';
import type { GstProviderAccountPayload } from '../types/gst-config.types';
export declare class GstProviderAccountService {
    private readonly prisma;
    private readonly support;
    constructor(prisma: PrismaService, support: GstConfigSupport);
    getById(gpaId: string): Promise<GstProviderAccountPayload>;
    save(dto: SaveGstProviderAccountDto): Promise<GstProviderAccountPayload>;
    softDelete(gpaId: string): Promise<{
        gpaId: string;
        deleted: boolean;
    }>;
    private duplicate;
}
