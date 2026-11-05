import { SaveSaleAgentDto } from './dto/save-sale-agent.dto';
import { SaleAgentService } from './sale-agent.service';
import { SaleAgentPayload, SaleAgentSuccessResponse } from './types/sale-agent-api.types';
export declare class SaleAgentController {
    private readonly saleAgentService;
    constructor(saleAgentService: SaleAgentService);
    save(saveSaleAgentDto: SaveSaleAgentDto): Promise<SaleAgentSuccessResponse<SaleAgentPayload>>;
    getById(saId: string): Promise<SaleAgentSuccessResponse<SaleAgentPayload>>;
    remove(saId: string): Promise<SaleAgentSuccessResponse<{
        saId: string;
        deleted: true;
    }>>;
}
