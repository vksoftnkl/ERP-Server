import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import type { BatchDetailModelsQueryDto, UpdateBatchDetailDto } from './dto/batch-detail.dto';
export interface BatchDetailRecord {
    sbdId: string;
    companyId: string;
    batchNo: string;
    itemId: string;
    itemName: string | null;
    sizeId: string | null;
    sizeName: string | null;
    colourId: string | null;
    colourName: string | null;
    model: string | null;
    srcDocType: string | null;
    srcDocId: string | null;
    srcLineId: string | null;
}
export declare class BatchDetailService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    models(q: BatchDetailModelsQueryDto): Promise<string[]>;
    update(dto: UpdateBatchDetailDto): Promise<BatchDetailRecord>;
    private assertSourceNotDraft;
    private record;
}
