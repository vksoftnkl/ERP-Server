import { PrismaService } from "../../../database/prisma/prisma.service";
import { GstConfigSupport } from './gst-config.support';
import { SaveGstProviderEndpointDto, SaveGstProviderErrorMapDto, SaveGstProviderFieldMapDto, SaveGstProviderServiceDto } from '../dto/save-gst-provider.dto';
import type { GstProviderEndpointPayload, GstProviderErrorMapPayload, GstProviderFieldMapPayload, GstProviderServicePayload } from '../types/gst-config.types';
export declare class GstProviderPartsService {
    private readonly prisma;
    private readonly support;
    constructor(prisma: PrismaService, support: GstConfigSupport);
    saveService(dto: SaveGstProviderServiceDto): Promise<GstProviderServicePayload>;
    deleteService(gpsId: string): Promise<{
        gpsId: string;
        deleted: boolean;
        endpointsDeleted: number;
    }>;
    getEndpoint(gpeId: string): Promise<GstProviderEndpointPayload>;
    saveEndpoint(dto: SaveGstProviderEndpointDto): Promise<GstProviderEndpointPayload>;
    deleteEndpoint(gpeId: string): Promise<{
        gpeId: string;
        deleted: boolean;
        fieldMapsDeleted: number;
    }>;
    saveFieldMap(dto: SaveGstProviderFieldMapDto): Promise<GstProviderFieldMapPayload>;
    deleteFieldMap(gfmId: string): Promise<{
        gfmId: string;
        deleted: boolean;
    }>;
    saveErrorMap(dto: SaveGstProviderErrorMapDto): Promise<GstProviderErrorMapPayload>;
    deleteErrorMap(gemId: string): Promise<{
        gemId: string;
        deleted: boolean;
    }>;
    private requireSaveRight;
    private liveProvider;
    private liveService;
    private liveEndpoint;
    private endpointCount;
    private storedHeaders;
    private validHeaders;
    private duplicateService;
    private alreadyDeleted;
}
