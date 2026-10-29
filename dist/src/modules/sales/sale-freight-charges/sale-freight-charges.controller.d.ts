import { SaleFreightChargeService } from './sale-freight-charges.service';
import { SaveSaleFreightChargeDto } from './dto/save-sale-freight-charges.dto';
import { SaleFreightChargePayload, SaleFreightChargeSuccessResponse } from './types/sale-freight-charges-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SaleFreightChargeController {
    private readonly saleFreightChargeService;
    private readonly requestContextService;
    constructor(saleFreightChargeService: SaleFreightChargeService, requestContextService: RequestContextService);
    createSaleFreightCharge(dto: SaveSaleFreightChargeDto): Promise<SaleFreightChargeSuccessResponse<SaleFreightChargePayload>>;
    getById(frId: string): Promise<SaleFreightChargeSuccessResponse<SaleFreightChargePayload>>;
    remove(frId: string): Promise<SaleFreightChargeSuccessResponse<{
        frId: string;
        deleted: true;
    }>>;
}
