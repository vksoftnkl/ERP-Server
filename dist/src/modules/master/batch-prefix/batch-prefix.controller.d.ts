import { ListBatchPrefixQueryDto } from './dto/list-batch-prefix-query.dto';
import { SaveBatchPrefixDto } from './dto/save-batch-prefix.dto';
import { BatchPrefixService } from './batch-prefix.service';
import { BatchPrefixListItem, BatchPrefixListMeta, BatchPrefixPayload, BatchPrefixSuccessResponse } from './types/batch-prefix-api.types';
export declare class BatchPrefixController {
    private readonly batchPrefixService;
    constructor(batchPrefixService: BatchPrefixService);
    save(saveBatchPrefixDto: SaveBatchPrefixDto): Promise<BatchPrefixSuccessResponse<BatchPrefixPayload>>;
    list(queryDto: ListBatchPrefixQueryDto): Promise<BatchPrefixSuccessResponse<BatchPrefixListItem[], BatchPrefixListMeta>>;
    getById(id: string): Promise<BatchPrefixSuccessResponse<BatchPrefixPayload>>;
    remove(id: string): Promise<BatchPrefixSuccessResponse<{
        id: string;
        deleted: true;
    }>>;
}
