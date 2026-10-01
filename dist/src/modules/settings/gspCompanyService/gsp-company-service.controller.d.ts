import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import { GspCompanyServiceService } from './gsp-company-service.service';
import { GspCompanyServicePayload, GspCompanyServiceSuccessResponse } from './types/gsp-company-service-api.types';
export declare class GspCompanyServiceController {
    private readonly gspCompanyServiceService;
    constructor(gspCompanyServiceService: GspCompanyServiceService);
    save(saveGspCompanyServiceDto: SaveGspCompanyServiceDto): Promise<GspCompanyServiceSuccessResponse<GspCompanyServicePayload>>;
    getById(csgCompanyServiceId: string): Promise<GspCompanyServiceSuccessResponse<GspCompanyServicePayload>>;
    remove(csgCompanyServiceId: string): Promise<GspCompanyServiceSuccessResponse<{
        csgCompanyServiceId: string;
        deleted: true;
    }>>;
}
