import { BatchDetailService, type BatchDetailRecord } from './batch-detail.service';
import { BatchDetailModelsQueryDto, UpdateBatchDetailDto } from './dto/batch-detail.dto';
export declare class BatchDetailController {
    private readonly service;
    constructor(service: BatchDetailService);
    models(q: BatchDetailModelsQueryDto): Promise<{
        success: true;
        message: string;
        data: string[];
    }>;
    update(dto: UpdateBatchDetailDto): Promise<{
        success: true;
        message: string;
        data: BatchDetailRecord;
    }>;
}
