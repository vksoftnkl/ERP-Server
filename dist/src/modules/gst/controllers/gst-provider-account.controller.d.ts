import { GstProviderAccountService } from '../config/gst-provider-account.service';
import { GstProviderAccountIdDto } from '../dto/gst-ids.dto';
import { SaveGstProviderAccountDto } from '../dto/save-gst-provider-account.dto';
import type { GstProviderAccountPayload, GstSuccessResponse } from '../types/gst-config.types';
export declare class GstProviderAccountController {
    private readonly accounts;
    constructor(accounts: GstProviderAccountService);
    create(dto: SaveGstProviderAccountDto): Promise<GstSuccessResponse<GstProviderAccountPayload>>;
    get(query: GstProviderAccountIdDto): Promise<GstSuccessResponse<GstProviderAccountPayload>>;
    delete(dto: GstProviderAccountIdDto): Promise<GstSuccessResponse<{
        gpaId: string;
        deleted: boolean;
    }>>;
}
