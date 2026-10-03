import { GstCompanyCredentialService } from '../config/gst-company-credential.service';
import { GstCompanyCredentialIdDto } from '../dto/gst-ids.dto';
import { SaveGstCompanyCredentialDto } from '../dto/save-gst-company-credential.dto';
import type { GstCompanyCredentialPayload, GstCredentialStatus, GstCredentialVerifyResult, GstSuccessResponse } from '../types/gst-config.types';
export declare class GstCompanyCredentialController {
    private readonly credentials;
    constructor(credentials: GstCompanyCredentialService);
    create(dto: SaveGstCompanyCredentialDto): Promise<GstSuccessResponse<GstCompanyCredentialPayload>>;
    get(query: GstCompanyCredentialIdDto): Promise<GstSuccessResponse<GstCompanyCredentialPayload>>;
    delete(dto: GstCompanyCredentialIdDto): Promise<GstSuccessResponse<{
        gccId: string;
        deleted: boolean;
    }>>;
    restore(dto: GstCompanyCredentialIdDto): Promise<GstSuccessResponse<{
        gccId: string;
        deleted: boolean;
    }>>;
    verify(dto: GstCompanyCredentialIdDto): Promise<GstSuccessResponse<GstCredentialVerifyResult>>;
    status(query: GstCompanyCredentialIdDto): Promise<GstSuccessResponse<GstCredentialStatus>>;
}
