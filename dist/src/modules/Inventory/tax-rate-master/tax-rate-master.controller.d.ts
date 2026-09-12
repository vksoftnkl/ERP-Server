import { SaveTaxRateDto } from './dto/save-tax-rate.dto';
import { DeleteTaxRateQueryDto, ListTaxRateQueryDto, ResolveTaxRateQueryDto, TaxRateIdQueryDto } from './dto/tax-rate-query.dto';
import { TaxRateMasterService } from './tax-rate-master.service';
import { TaxRateDeleteResult, TaxRatePayload, TaxRateResolution, TaxRateSuccessResponse } from './types/tax-rate-api.types';
export declare class TaxRateMasterController {
    private readonly taxRateMasterService;
    constructor(taxRateMasterService: TaxRateMasterService);
    save(dto: SaveTaxRateDto): Promise<TaxRateSuccessResponse<TaxRatePayload>>;
    getById(query: TaxRateIdQueryDto): Promise<TaxRateSuccessResponse<TaxRatePayload>>;
    list(query: ListTaxRateQueryDto): Promise<TaxRateSuccessResponse<TaxRatePayload[]>>;
    resolve(query: ResolveTaxRateQueryDto): Promise<TaxRateSuccessResponse<TaxRateResolution>>;
    remove(query: DeleteTaxRateQueryDto): Promise<TaxRateSuccessResponse<TaxRateDeleteResult>>;
}
