import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import { CompanyGroupMasterService } from './company-group-master.service';
import { CompanyGroupMasterPayload, CompanyGroupMasterSuccessResponse } from './types/company-group-master-api.types';
export declare class CompanyGroupMasterController {
    private readonly companyGroupMasterService;
    constructor(companyGroupMasterService: CompanyGroupMasterService);
    save(saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto): Promise<CompanyGroupMasterSuccessResponse<CompanyGroupMasterPayload>>;
    getById(cogGroupId: string): Promise<CompanyGroupMasterSuccessResponse<CompanyGroupMasterPayload>>;
    remove(cogGroupId: string): Promise<CompanyGroupMasterSuccessResponse<{
        cogGroupId: string;
        deleted: true;
    }>>;
}
