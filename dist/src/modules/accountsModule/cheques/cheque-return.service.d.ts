import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { type LockedCheque } from './cheques.guards';
import { ReturnChequeDto } from './dto/cheque-actions.dto';
import type { ChequeCascadeReport, ChequeReturnPayload } from './types/cheque-api.types';
export declare class ChequeReturnService {
    private readonly prisma;
    private readonly requestContext;
    private readonly recompute;
    constructor(prisma: PrismaService, requestContext: RequestContextService, recompute: BillBalanceRecomputeService);
    return(dto: ReturnChequeDto): Promise<ChequeReturnPayload>;
    unwind(tx: Prisma.TransactionClient, cheque: LockedCheque, params: {
        reason: string;
        actor: string;
        asOf: Date;
    }): Promise<{
        voucher: ChequeReturnPayload['reversalVoucher'];
        legs: ChequeReturnPayload['legs'];
        billsReopened: ChequeReturnPayload['billsReopened'];
        cascade: ChequeCascadeReport;
    }>;
    private loadBillRefs;
}
