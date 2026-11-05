import { SettlementResolution, WriteOffTreatment } from '../types/tender-settlement-enum';
export declare class ImportSettlementDto {
    companyId: string;
    branchId: string;
    tenderId: string;
    payoutRef?: string;
    payoutDate?: string;
    notes?: string | null;
    file?: unknown;
}
export declare class SettlementKeyDto {
    companyId: string;
    branchId: string;
    accYear: string;
    asiId: string;
}
export declare class VoidSettlementDto extends SettlementKeyDto {
    reason: string;
}
export declare class SettlementLineKeyDto {
    companyId: string;
    branchId: string;
    accYear: string;
    aslId: string;
}
export declare class ConfirmSettlementLineDto extends SettlementLineKeyDto {
    tdId?: string;
    tdAccYear?: string;
}
export declare class IgnoreSettlementLineDto extends SettlementLineKeyDto {
    notes: string;
}
export declare class ResolveSettlementLineDto extends SettlementLineKeyDto {
    resolution: SettlementResolution;
    reasonId: string;
    tdId?: string;
    tdAccYear?: string;
    incomeLedgerId?: string | null;
    notes?: string | null;
}
export declare class WriteOffTenderDto {
    companyId: string;
    branchId: string;
    tdId: string;
    tdAccYear: string;
    treatment: WriteOffTreatment;
    reasonId: string;
    recoveryLedgerId?: string | null;
    notes?: string | null;
}
export declare class SettlementFormatQueryDto {
    companyId: string;
    tenderId: string;
}
export declare class SaveSettlementFormatDto extends SettlementFormatQueryDto {
    format: Record<string, unknown> | null;
}
export declare class TestSettlementFormatDto extends SettlementFormatQueryDto {
    file?: unknown;
}
