import { SaveAccountGroupDto } from './dto/save-account-group.dto';
import { AccountsGroupService } from './accounts-group.service';
import { AccountGroupPayload, AccountGroupSuccessResponse } from './types/account-group-api.types';
export declare class AccountsGroupController {
    private readonly accountsGroupService;
    constructor(accountsGroupService: AccountsGroupService);
    save(saveAccountGroupDto: SaveAccountGroupDto): Promise<AccountGroupSuccessResponse<AccountGroupPayload>>;
    getById(accGroupId: string): Promise<AccountGroupSuccessResponse<AccountGroupPayload>>;
    remove(accGroupId: string): Promise<AccountGroupSuccessResponse<{
        accGroupId: string;
        deleted: true;
    }>>;
}
