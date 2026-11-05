import { TillScopeDto } from './till-session.dto';
export declare class RequestTillApprovalDto extends TillScopeDto {
    tenantId?: string | null;
    event: string;
    amount: number;
    sessionId?: string | null;
    accYear?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    srcRefno?: string | null;
    reasonId?: string | null;
    note?: string | null;
    approverId?: string | null;
    approverPin?: string | null;
    secondId?: string | null;
    secondPin?: string | null;
}
export declare class TillApprovalKeyDto extends TillScopeDto {
    accYear: string;
    tapId: string;
}
export declare class CancelTillApprovalDto extends TillApprovalKeyDto {
    note?: string | null;
}
export declare class DecideTillApprovalDto extends TillApprovalKeyDto {
    decision: 'APPROVE' | 'REJECT';
    note: string;
    approverPin?: string | null;
    secondId?: string | null;
    secondPin?: string | null;
}
