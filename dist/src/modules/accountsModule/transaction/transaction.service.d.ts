import { OpenItemsService } from '../receipt/open-items.service';
import { GetPartyAdjustableCreditsDto } from './dto/get-party-adjustable-credits.dto';
import { AdjustableCredit } from './types/transaction-api.types';
export declare class TransactionService {
    private readonly openItemsService;
    constructor(openItemsService: OpenItemsService);
    getPartyAdjustableCredits(query: GetPartyAdjustableCreditsDto): Promise<AdjustableCredit[]>;
}
