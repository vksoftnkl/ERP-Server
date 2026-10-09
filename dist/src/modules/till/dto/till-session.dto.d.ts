import { TillFloatMode } from '../types/till-enum';
export declare class TillScopeDto {
    companyId: string;
    branchId: string;
}
export declare class TillSessionKeyDto extends TillScopeDto {
    accYear: string;
    tssId: string;
}
export declare class TillCountLineDto {
    tenderTypeId: number;
    tenderId?: string | null;
    denominationId?: string | null;
    qty?: number;
    enteredAmount?: number;
    batchRef?: string | null;
}
export declare class TillOpenCheckQueryDto extends TillScopeDto {
    accYear?: string | null;
    deviceId?: string;
    userId?: string;
    counterId?: string;
}
export declare class OpenTillSessionDto extends TillScopeDto {
    tenantId?: string | null;
    counterId?: string;
    floatMode?: TillFloatMode;
    floatIssued?: number | null;
    prevSessionId?: string;
    lines: TillCountLineDto[];
    reasonId?: string | null;
    notes?: string | null;
}
export declare class SuspendTillSessionDto extends TillSessionKeyDto {
    reasonId?: string | null;
}
export declare class EndBillingTillSessionDto extends TillSessionKeyDto {
    outboxCount?: number;
    lastClientSeq?: number;
}
export declare class CountTillSessionDto extends TillSessionKeyDto {
    lines: TillCountLineDto[];
    witnessBy?: string | null;
    notes?: string | null;
}
export declare class CloseTillSessionDto extends TillSessionKeyDto {
    floatLeft?: number | null;
    notes?: string | null;
}
export declare class TillDayGetQueryDto extends TillScopeDto {
    accYear?: string;
    tbdId?: string;
}
export declare class OpenTillDayDto extends TillScopeDto {
    tenantId?: string | null;
}
export declare class TillClientEventDto {
    code: string;
    eventOn: string;
    clientSeq: number;
    sessionId?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    srcRefno?: string | null;
    amount?: number | null;
    reasonId?: string | null;
    payload?: Record<string, unknown> | null;
}
export declare class TillEventBatchDto extends TillScopeDto {
    accYear: string;
    events: TillClientEventDto[];
}
export declare class CreateTillMovementDto extends TillSessionKeyDto {
    kind: 'DROP' | 'PAID_IN' | 'EXCHANGE' | 'PICKUP' | 'TOP_UP';
    amount?: number | null;
    lines: TillCountLineDto[];
    outLines: TillCountLineDto[];
    reasonId?: string | null;
    ledgerId?: string | null;
    refNo?: string | null;
    refDate?: string | null;
    partyName?: string | null;
    bagNo?: string | null;
    sealNo?: string | null;
    witnessBy?: string | null;
    notes?: string | null;
}
export declare class TillMovementKeyDto extends TillScopeDto {
    accYear: string;
    tcmId: string;
}
export declare class VoidTillMovementDto extends TillMovementKeyDto {
    reasonId: string;
    notes?: string | null;
}
export declare class TillChangeDto extends TillScopeDto {
    accYear: string;
    fromTssId: string;
    toTssId: string;
    lines: TillCountLineDto[];
    reasonId: string;
    notes?: string | null;
}
export declare class TillSlipCheckQueryDto extends TillSessionKeyDto {
    tenderId: string;
}
export declare class TillSlipWithoutRowDto {
    amount: number;
    authCode?: string | null;
    cardLast4?: string | null;
}
export declare class TillSlipCheckDto extends TillSlipCheckQueryDto {
    ticked: number;
    noSlip: string[];
    amountDiffers: string[];
    slipsWithoutRow: TillSlipWithoutRowDto[];
    notes?: string | null;
}
