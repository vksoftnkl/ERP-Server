import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import { SaveBulkAccountLedgerMasterDto } from './dto/save-bulk-account-ledger-master.dto';
import { AccountLedgerMastersService } from './account-ledger-masters.service';
import { AccountLedgerMasterPayload, AccountLedgerMasterSuccessResponse, LedgerBankAccountPayload } from './types/account-ledger-master-api.types';
export declare class AccountLedgerMastersController {
    private readonly accountLedgerMastersService;
    constructor(accountLedgerMastersService: AccountLedgerMastersService);
    private readonly bodyValidationPipe;
    save(body: SaveAccountLedgerMasterDto | SaveBulkAccountLedgerMasterDto): Promise<AccountLedgerMasterSuccessResponse<AccountLedgerMasterPayload | AccountLedgerMasterPayload[]>>;
    private isBulkPayload;
    private validateBody;
    get(ledId: string | undefined): Promise<AccountLedgerMasterSuccessResponse<AccountLedgerMasterPayload | {
        data: AccountLedgerMasterPayload[];
        total: number;
    }>>;
    remove(ledId: string): Promise<AccountLedgerMasterSuccessResponse<{
        ledId: string;
        deleted: true;
    }>>;
    getBank(lbaId: string | undefined, ledId: string | undefined): Promise<AccountLedgerMasterSuccessResponse<LedgerBankAccountPayload | {
        data: LedgerBankAccountPayload[];
        total: number;
    }>>;
    removeBankAccounts(lbaId: string): Promise<AccountLedgerMasterSuccessResponse<{
        lbaId: string;
        deleted: true;
    }>>;
}
