import { LotByBatchQueryDto } from './dto/lot-by-batch-query.dto';
import { LotByBatchService, type LotByBatchRow } from './lot-by-batch.service';
export declare class LotByBatchController {
    private readonly service;
    constructor(service: LotByBatchService);
    find(q: LotByBatchQueryDto): Promise<{
        success: true;
        message: string;
        data: LotByBatchRow[];
    }>;
}
