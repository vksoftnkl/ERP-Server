import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { GetPriceLevelMasterQueryDto } from './dto/get-price-level-master-query.dto';
import { UpdatePriceLevelMasterDto } from './dto/update-price-level-master.dto';
import { PriceLevelMasterGetMeta, PriceLevelMasterPayload } from './types/price-level-master-api.types';
export declare class PriceLevelMasterService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    get(queryDto: GetPriceLevelMasterQueryDto): Promise<{
        items: PriceLevelMasterPayload[];
        meta: PriceLevelMasterGetMeta;
    }>;
    update(updateDto: UpdatePriceLevelMasterDto): Promise<PriceLevelMasterPayload[]>;
    private toPayload;
}
