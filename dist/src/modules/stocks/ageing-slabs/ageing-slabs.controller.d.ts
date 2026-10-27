import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { AgeingSlabsCompanyDto, SaveAgeingSlabsDto } from './dto/ageing-slabs.dto';
import { AgeingSlabsService, type AgeingSlabLadder } from './ageing-slabs.service';
export declare const AGEING_SLABS_MENU_ID = 294;
export declare class AgeingSlabsController {
    private readonly service;
    private readonly prisma;
    private readonly requestContext;
    constructor(service: AgeingSlabsService, prisma: PrismaService, requestContext: RequestContextService);
    get(query: AgeingSlabsCompanyDto): Promise<StockVoucherSuccessResponse<AgeingSlabLadder>>;
    save(dto: SaveAgeingSlabsDto): Promise<StockVoucherSuccessResponse<AgeingSlabLadder>>;
    revert(dto: AgeingSlabsCompanyDto): Promise<StockVoucherSuccessResponse<AgeingSlabLadder>>;
    private requireRight;
}
