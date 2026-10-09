export declare class TillErrorDetailDto {
    field: string;
    message: string;
    code?: string;
    event?: string;
    amount?: number;
    requiredRole?: string;
}
export declare class TillErrorResponseDto {
    success: false;
    message: string;
    errors: TillErrorDetailDto[];
}
export declare class TillSuccessDto {
    success: true;
    message: string;
    data: Record<string, unknown>;
}
export declare class TillListSuccessDto {
    success: true;
    message: string;
    data: Record<string, unknown>[];
}
export declare class TillApprovalNeedDto {
    event: string;
    ruleId: string;
    mode: string;
    threshold: number;
    amount: number;
    minRole: string;
    channel: string;
    twoPerson: boolean;
    blocksTill: boolean;
    enforced: false;
}
