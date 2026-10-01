import { PrismaService } from '../../../database/prisma/prisma.service';
import { ChequeHistoryQueryDto, DepositSlipQueryDto, GetChequeQueryDto, ListChequesQueryDto } from './dto/cheque-query.dto';
import type { ChequeDetailPayload, ChequeHistoryPayload, ChequeListPayload, DepositSlipPayload } from './types/cheque-api.types';
export declare class ChequesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: ListChequesQueryDto): Promise<ChequeListPayload>;
    private buildWhere;
    get(query: GetChequeQueryDto): Promise<ChequeDetailPayload>;
    private loadTouchedBills;
    private loadChainRow;
    private loadRowByKey;
    history(query: ChequeHistoryQueryDto): Promise<ChequeHistoryPayload>;
    depositSlip(query: DepositSlipQueryDto): Promise<DepositSlipPayload>;
    private toRow;
}
