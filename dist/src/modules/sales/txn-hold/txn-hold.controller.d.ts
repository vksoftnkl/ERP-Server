import { ListTxnHoldQueryDto } from './dto/list-txn-hold-query.dto';
import { ConvertTxnHoldDto, LockTxnHoldDto } from './dto/lock-txn-hold.dto';
import { SaveTxnHoldDto } from './dto/save-txn-hold.dto';
import { TxnHoldService } from './txn-hold.service';
import { TxnHoldDeleteResult, TxnHoldListItem, TxnHoldListMeta, TxnHoldPayload, TxnHoldSuccessResponse } from './types/txn-hold-api.types';
export declare class TxnHoldController {
    private readonly txnHoldService;
    constructor(txnHoldService: TxnHoldService);
    save(saveTxnHoldDto: SaveTxnHoldDto): Promise<TxnHoldSuccessResponse<TxnHoldPayload>>;
    list(queryDto: ListTxnHoldQueryDto): Promise<TxnHoldSuccessResponse<TxnHoldListItem[], TxnHoldListMeta>>;
    getById(txhId: string, txhAccYear?: string): Promise<TxnHoldSuccessResponse<TxnHoldPayload>>;
    resume(txhId: string, deviceId: string | undefined, lockDto: LockTxnHoldDto): Promise<TxnHoldSuccessResponse<TxnHoldPayload>>;
    release(txhId: string, deviceId: string | undefined, lockDto: LockTxnHoldDto): Promise<TxnHoldSuccessResponse<TxnHoldPayload>>;
    forceRelease(txhId: string, deviceId: string | undefined, lockDto: LockTxnHoldDto): Promise<TxnHoldSuccessResponse<TxnHoldPayload>>;
    convert(txhId: string, deviceId: string | undefined, convertDto: ConvertTxnHoldDto): Promise<TxnHoldSuccessResponse<TxnHoldPayload>>;
    remove(txhId: string, txhAccYear?: string): Promise<TxnHoldSuccessResponse<TxnHoldDeleteResult>>;
}
