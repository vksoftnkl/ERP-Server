import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { BounceChequeDto } from './dto/cheque-actions.dto';
import type { ChequeBouncePayload } from './types/cheque-api.types';
export declare class ChequeBounceService {
    private readonly prisma;
    private readonly requestContext;
    private readonly recompute;
    constructor(prisma: PrismaService, requestContext: RequestContextService, recompute: BillBalanceRecomputeService);
    bounce(dto: BounceChequeDto): Promise<ChequeBouncePayload>;
    private resolveRoles;
    private buildLegs;
    private writeChargeBill;
    private loadBillRefs;
}
