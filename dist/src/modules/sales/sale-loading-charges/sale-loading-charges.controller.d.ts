import { SaleLoadingChargeService } from './sale-loading-charges.service';
import { SaveSaleLoadingChargeDto } from './dto/save-sale-loading-charges.dto';
import { SaleLoadingChargePayload, SaleLoadingChargeSuccessResponse } from './types/sale-loading-charges-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SaleLoadingChargeController {
    private readonly saleLoadingChargeService;
    private readonly requestContextService;
    constructor(saleLoadingChargeService: SaleLoadingChargeService, requestContextService: RequestContextService);
    createSaleLoadingCharge(dto: SaveSaleLoadingChargeDto): Promise<SaleLoadingChargeSuccessResponse<SaleLoadingChargePayload>>;
    getById(ilcId: string): Promise<SaleLoadingChargeSuccessResponse<SaleLoadingChargePayload>>;
    remove(ilcId: string): Promise<SaleLoadingChargeSuccessResponse<{
        ilcId: string;
        deleted: true;
    }>>;
}
