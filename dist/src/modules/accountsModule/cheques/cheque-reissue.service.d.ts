import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { ChequeReturnService } from './cheque-return.service';
import { RepresentChequeDto, ReplaceChequeDto } from './dto/cheque-actions.dto';
import type { ChequeRepresentPayload, ChequeReplacePayload } from './types/cheque-api.types';
export declare class ChequeReissueService {
    private readonly prisma;
    private readonly requestContext;
    private readonly recompute;
    private readonly returnService;
    constructor(prisma: PrismaService, requestContext: RequestContextService, recompute: BillBalanceRecomputeService, returnService: ChequeReturnService);
    represent(dto: RepresentChequeDto): Promise<ChequeRepresentPayload>;
    replace(dto: ReplaceChequeDto): Promise<ChequeReplacePayload>;
    private reissue;
    private assertInstrumentDateUsable;
    private reloadLocked;
}
