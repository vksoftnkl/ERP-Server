import { TxnStatusService, type PendingDocumentsResult } from './txn-status.service';
export declare class PendingTxnStatusQueryDto {
    companyId: string;
    branchId?: string;
    accYear: string;
    upToDate?: string;
    srcModule?: string;
    limit?: number;
    offset?: number;
}
export declare class TxnStatusController {
    private readonly service;
    constructor(service: TxnStatusService);
    pending(query: PendingTxnStatusQueryDto): Promise<{
        success: true;
        message: string;
        data: PendingDocumentsResult;
    }>;
}
