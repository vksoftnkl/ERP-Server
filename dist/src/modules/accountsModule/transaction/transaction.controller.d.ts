import { GetPartyAdjustableCreditsDto } from './dto/get-party-adjustable-credits.dto';
import { TransactionService } from './transaction.service';
import { AdjustableCredit, TransactionSuccessResponse } from './types/transaction-api.types';
export declare class TransactionController {
    private readonly transactionService;
    constructor(transactionService: TransactionService);
    get(getPartyAdjustableCreditsDto: GetPartyAdjustableCreditsDto): Promise<TransactionSuccessResponse<AdjustableCredit[]>>;
}
