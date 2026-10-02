import { PrismaService } from "../../../database/prisma/prisma.service";
import { GstConfigSupport } from './gst-config.support';
import { SaveGstProviderDto } from '../dto/save-gst-provider.dto';
import type { GstProviderPayload } from '../types/gst-config.types';
export declare class GstProviderService {
    private readonly prisma;
    private readonly support;
    constructor(prisma: PrismaService, support: GstConfigSupport);
    getById(gpvId: string): Promise<GstProviderPayload>;
    save(dto: SaveGstProviderDto): Promise<GstProviderPayload>;
    softDelete(gpvId: string): Promise<{
        gpvId: string;
        deleted: boolean;
    }>;
    restore(gpvId: string): Promise<{
        gpvId: string;
        deleted: boolean;
    }>;
    private setDeleted;
    private assertCodeIsFree;
    private credentialCount;
    private load;
}
