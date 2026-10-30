import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import { LedgerBankAccountService } from './ledger-bank-account.service';
import { LedgerBankAccountPayload, LedgerBankAccountSuccessResponse } from './types/ledger-bank-account-api.types';
export declare class LedgerBankAccountController {
    private readonly ledgerBankAccountService;
    constructor(ledgerBankAccountService: LedgerBankAccountService);
    save(saveLedgerBankAccountDto: SaveLedgerBankAccountDto): Promise<LedgerBankAccountSuccessResponse<LedgerBankAccountPayload>>;
    getById(lbaId: string): Promise<LedgerBankAccountSuccessResponse<LedgerBankAccountPayload>>;
    remove(lbaId: string): Promise<LedgerBankAccountSuccessResponse<{
        lbaId: string;
        deleted: true;
    }>>;
}
