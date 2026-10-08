import { ListBankListQueryDto } from './dto/list-bank-list-query.dto';
import { SaveBankListDto } from './dto/save-bank-list.dto';
import { BankListService } from './bank-list.service';
import { BankListItem, BankListMeta, BankListPayload, BankListSuccessResponse } from './types/bank-list-api.types';
export declare class BankListController {
    private readonly bankListService;
    constructor(bankListService: BankListService);
    save(saveBankListDto: SaveBankListDto): Promise<BankListSuccessResponse<BankListPayload>>;
    list(queryDto: ListBankListQueryDto): Promise<BankListSuccessResponse<BankListItem[], BankListMeta>>;
    getById(bnkId: string): Promise<BankListSuccessResponse<BankListPayload>>;
    remove(bnkId: string): Promise<BankListSuccessResponse<{
        bnkId: string;
        deleted: true;
    }>>;
}
