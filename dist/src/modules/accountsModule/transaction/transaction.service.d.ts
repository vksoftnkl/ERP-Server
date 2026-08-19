import { PgService } from '../../../database/pg/pg.service';
import { GetPartyAdjustableCreditsDto } from './dto/get-party-adjustable-credits.dto';
import { AdjustableCredit } from './types/transaction-api.types';
export declare class TransactionService {
    private readonly pg;
    constructor(pg: PgService);
    getPartyAdjustableCredits(query: GetPartyAdjustableCreditsDto): Promise<AdjustableCredit[]>;
}
