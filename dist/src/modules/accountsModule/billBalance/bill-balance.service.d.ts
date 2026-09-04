import { PgService } from '../../../database/pg/pg.service';
import { GetPartyCreditSummaryDto } from './dto/get-party-credit-summary.dto';
import { PartyCreditSummary } from './types/bill-balance-api.types';
export declare class BillBalanceService {
    private readonly pg;
    constructor(pg: PgService);
    getCreditSummary(query: GetPartyCreditSummaryDto): Promise<PartyCreditSummary>;
}
