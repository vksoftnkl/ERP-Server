import { TillFloatMode, TillVarianceDecision, type TillVarianceTreatment } from '../types/till-enum';
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
export declare class DecideTillVarianceDto extends TillSessionKeyDto {
    decision: TillVarianceDecision;
    treatment?: TillVarianceTreatment | null;
    reasonId?: string | null;
    note: string;
    approverPin?: string | null;
    tcmId?: string | null;
}
export declare class ApproveTillCashDto extends TillSessionKeyDto {
    approverPin?: string | null;
    receivedAmount?: number | null;
    treatment?: TillVarianceTreatment | null;
    reasonId?: string | null;
    notes?: string | null;
}
export declare class ForceCloseTillSessionDto extends TillSessionKeyDto {
    reasonId: string;
    approverPin?: string | null;
    lines: TillCountLineDto[];
    floatLeft?: number | null;
    notes?: string | null;
}
export declare class ReopenTillSessionDto extends TillSessionKeyDto {
    reasonId: string;
    approverPin?: string | null;
    notes?: string | null;
}
export declare class TillDayKeyDto extends TillScopeDto {
    accYear: string;
    tbdId: string;
}
export declare class TillDayCloseCountDto {
    tssId: string;
    lines: TillCountLineDto[];
    floatLeft?: number | null;
}
export declare class TillDayCloseExceptionDto {
    reasonId: string;
    approverId?: string | null;
    approverPin?: string | null;
    counts?: TillDayCloseCountDto[];
}
export declare class CloseTillDayDto extends TillDayKeyDto {
    notes?: string | null;
    exception?: TillDayCloseExceptionDto | null;
}
export declare class ReopenTillDayDto extends TillDayKeyDto {
    reasonId: string;
    approverPin?: string | null;
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
    witnessPin?: string | null;
    supervisorId?: string | null;
    supervisorPin?: string | null;
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
export declare class TillAwaitingReceiptQueryDto extends TillScopeDto {
    dayId?: string;
    accYear?: string;
}
export declare class TillReceiveBagDto {
    accYear: string;
    tcmId: string;
    lines: TillCountLineDto[];
    notes?: string | null;
}
export declare class TillReceiveDto extends TillScopeDto {
    receiverPin?: string | null;
    bags: TillReceiveBagDto[];
}
export declare class TillChangeDto extends TillScopeDto {
    accYear: string;
    fromTssId: string;
    toTssId: string;
    lines: TillCountLineDto[];
    reasonId: string;
    fromWitnessPin?: string | null;
    toWitnessPin?: string | null;
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
