import { GstProviderPartsService } from '../config/gst-provider-parts.service';
import { GstProviderEndpointIdDto, GstProviderErrorMapIdDto, GstProviderFieldMapIdDto, GstProviderServiceIdDto } from '../dto/gst-ids.dto';
import { SaveGstProviderEndpointDto, SaveGstProviderErrorMapDto, SaveGstProviderFieldMapDto, SaveGstProviderServiceDto } from '../dto/save-gst-provider.dto';
import type { GstProviderEndpointPayload, GstProviderErrorMapPayload, GstProviderFieldMapPayload, GstProviderServicePayload, GstSuccessResponse } from '../types/gst-config.types';
export declare class GstProviderServiceController {
    private readonly parts;
    constructor(parts: GstProviderPartsService);
    create(dto: SaveGstProviderServiceDto): Promise<GstSuccessResponse<GstProviderServicePayload>>;
    delete(dto: GstProviderServiceIdDto): Promise<GstSuccessResponse<{
        gpsId: string;
        deleted: boolean;
        endpointsDeleted: number;
    }>>;
}
export declare class GstProviderEndpointController {
    private readonly parts;
    constructor(parts: GstProviderPartsService);
    create(dto: SaveGstProviderEndpointDto): Promise<GstSuccessResponse<GstProviderEndpointPayload>>;
    get(query: GstProviderEndpointIdDto): Promise<GstSuccessResponse<GstProviderEndpointPayload>>;
    delete(dto: GstProviderEndpointIdDto): Promise<GstSuccessResponse<{
        gpeId: string;
        deleted: boolean;
        fieldMapsDeleted: number;
    }>>;
}
export declare class GstProviderFieldMapController {
    private readonly parts;
    constructor(parts: GstProviderPartsService);
    create(dto: SaveGstProviderFieldMapDto): Promise<GstSuccessResponse<GstProviderFieldMapPayload>>;
    delete(dto: GstProviderFieldMapIdDto): Promise<GstSuccessResponse<{
        gfmId: string;
        deleted: boolean;
    }>>;
}
export declare class GstProviderErrorMapController {
    private readonly parts;
    constructor(parts: GstProviderPartsService);
    create(dto: SaveGstProviderErrorMapDto): Promise<GstSuccessResponse<GstProviderErrorMapPayload>>;
    delete(dto: GstProviderErrorMapIdDto): Promise<GstSuccessResponse<{
        gemId: string;
        deleted: boolean;
    }>>;
}
