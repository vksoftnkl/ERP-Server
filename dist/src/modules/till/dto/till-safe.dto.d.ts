import { TillRemitMode, type TillSafeGapTreatment } from '../types/till-enum';
import { TillCountLineDto, TillScopeDto } from './till-session.dto';
export declare class TillSafeBalanceQueryDto extends TillScopeDto {
    safeId?: string;
}
declare class TillSafeGapDecisionDto extends TillScopeDto {
    treatment?: TillSafeGapTreatment | null;
    reasonId?: string | null;
    approverPin?: string | null;
    witnessId?: string | null;
    witnessPin?: string | null;
    notes?: string | null;
}
export declare class CountTillSafeDto extends TillSafeGapDecisionDto {
    tenantId?: string | null;
    safeId: string;
    lines: TillCountLineDto[];
}
export declare class DecideTillSafeVarianceDto extends TillScopeDto {
    accYear: string;
    tvrId: string;
    treatment: TillSafeGapTreatment;
    reasonId: string;
    approverPin?: string | null;
    secondId?: string | null;
    secondPin?: string | null;
    notes?: string | null;
}
export declare class RemitTillCashDto extends TillScopeDto {
    tenantId?: string | null;
    safeId: string;
    amount: number;
    bankLedgerId: string;
    mode: TillRemitMode;
    bagNo?: string | null;
    sealNo?: string | null;
    citAgency?: string | null;
    slipNo?: string | null;
    slipDate?: string | null;
    lines?: TillCountLineDto[] | null;
    notes?: string | null;
    approverId?: string | null;
    approverPin?: string | null;
}
export declare class ConfirmTillRemitDto extends TillSafeGapDecisionDto {
    accYear: string;
    tcmId: string;
    bankDate: string;
    bankRef: string;
    bankAmount?: number | null;
}
export {};
