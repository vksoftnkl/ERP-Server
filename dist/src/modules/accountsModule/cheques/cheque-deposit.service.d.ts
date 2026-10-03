import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DepositChequesDto } from './dto/deposit-cheques.dto';
import type { ChequeDepositPayload } from './types/cheque-api.types';
export declare class ChequeDepositService {
    private readonly prisma;
    private readonly requestContext;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    deposit(dto: DepositChequesDto): Promise<ChequeDepositPayload>;
    private pick;
}
export declare function buildSlipSummary(bank: {
    ledgerId: string;
    ledgerName: string;
}, depositDate: Date, slipNo: string, amounts: readonly Prisma.Decimal[]): ChequeDepositPayload['slip'];
