import { GstProviderService } from '../config/gst-provider.service';
import { GstProviderIdDto } from '../dto/gst-ids.dto';
import { SaveGstProviderDto } from '../dto/save-gst-provider.dto';
import type { GstProviderPayload, GstSuccessResponse } from '../types/gst-config.types';
export declare class GstProviderController {
    private readonly providers;
    constructor(providers: GstProviderService);
    create(dto: SaveGstProviderDto): Promise<GstSuccessResponse<GstProviderPayload>>;
    get(query: GstProviderIdDto): Promise<GstSuccessResponse<GstProviderPayload>>;
    delete(dto: GstProviderIdDto): Promise<GstSuccessResponse<{
        gpvId: string;
        deleted: boolean;
    }>>;
    restore(dto: GstProviderIdDto): Promise<GstSuccessResponse<{
        gpvId: string;
        deleted: boolean;
    }>>;
}
