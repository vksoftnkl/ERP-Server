import { QuotationService } from './quotation.service';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { QuotationPayload, QuotationSuccessResponse } from './types/quotation-api.types';
export declare class QuotationController {
    private readonly quotationService;
    constructor(quotationService: QuotationService);
    save(saveQuotationDto: SaveQuotationDto): Promise<QuotationSuccessResponse<QuotationPayload>>;
    getById(sqId: string, sqCompanyId: string, sqBranchId: string, sqAccYear: string): Promise<QuotationSuccessResponse<QuotationPayload>>;
    remove(sqId: string, sqCompanyId: string, sqBranchId: string, sqAccYear: string): Promise<QuotationSuccessResponse<{
        sqId: string;
        deleted: true;
    }>>;
}
