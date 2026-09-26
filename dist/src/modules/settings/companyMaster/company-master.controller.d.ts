import { SaveCompanyMasterDto } from './dto/save-company-master.dto';
import { CompanyMasterService } from './company-master.service';
import { CompanyMasterPayload, CompanyMasterSuccessResponse } from './types/company-master-api.types';
export declare class CompanyMasterController {
    private readonly companyMasterService;
    constructor(companyMasterService: CompanyMasterService);
    save(saveCompanyMasterDto: SaveCompanyMasterDto): Promise<CompanyMasterSuccessResponse<CompanyMasterPayload>>;
    getById(compId: string): Promise<CompanyMasterSuccessResponse<CompanyMasterPayload>>;
    remove(compId: string): Promise<CompanyMasterSuccessResponse<{
        compId: string;
        deleted: true;
    }>>;
}
