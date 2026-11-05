import { PrismaService } from '../../../database/prisma/prisma.service';
import { GetHsnCodeMasterQueryDto } from './dto/get-hsn-code-master-query.dto';
import { HsnCodeMasterGetMeta, HsnCodeMasterPayload } from './types/hsn-code-master-api.types';
export declare class HsnCodeMasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    get(queryDto: GetHsnCodeMasterQueryDto): Promise<{
        items: HsnCodeMasterPayload[];
        meta: HsnCodeMasterGetMeta;
    }>;
    private toPayload;
}
