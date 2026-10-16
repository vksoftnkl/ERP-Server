import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { ClearChequeDto } from './dto/cheque-actions.dto';
import type { ChequeClearPayload } from './types/cheque-api.types';
export declare class ChequeClearService {
    private readonly prisma;
    private readonly requestContext;
    private readonly recompute;
    constructor(prisma: PrismaService, requestContext: RequestContextService, recompute: BillBalanceRecomputeService);
    clear(dto: ClearChequeDto): Promise<ChequeClearPayload>;
    private clearOnReceipt;
    private clearOnClearing;
}
