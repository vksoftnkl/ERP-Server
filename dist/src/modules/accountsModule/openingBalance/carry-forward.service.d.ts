import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { OpeningBalanceService } from './opening-balance.service';
import { CarryForwardDto } from './dto/carry-forward.dto';
import { type CarryForwardPayload } from './types/opening-balance-api.types';
export declare class CarryForwardService {
    private readonly prisma;
    private readonly openingBalanceService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, openingBalanceService: OpeningBalanceService, requestContextService: RequestContextService);
    run(dto: CarryForwardDto): Promise<CarryForwardPayload>;
    private profitAndLossResult;
    private carryBills;
    private stampFiscalYear;
    private totals;
    private requireAccYear;
}
