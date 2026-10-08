import { PdcStatus } from '../../receipt/types/receipt-enum';
import { ChequeAllocationDto, ChequeKeysDto } from './cheque-keys.dto';
export declare class ClearChequeDto extends ChequeKeysDto {
    clearDate: string;
    bankDate?: string | null;
    allocations: ChequeAllocationDto[];
    remarks?: string | null;
}
export declare class BounceChequeDto extends ChequeKeysDto {
    bounceDate: string;
    reason: string;
    reasonText?: string | null;
    bankCharge: number;
    partyCharge: number;
}
export declare class RepresentChequeDto extends ChequeKeysDto {
    bankLedgerId: string;
    depositDate: string;
    slipNo: string;
    allocations: ChequeAllocationDto[];
    remarks?: string | null;
}
export declare class ReplacementChequeDto {
    instrumentNo: string;
    instrumentDate: string;
    amount: number;
    bankName?: string | null;
    bankBranch?: string | null;
    ifsc?: string | null;
    micr?: string | null;
    drawerName?: string | null;
}
export declare class ReplaceChequeDto extends ChequeKeysDto {
    newCheque: ReplacementChequeDto;
    allocations: ChequeAllocationDto[];
    reason?: string | null;
}
export declare class ReturnChequeDto extends ChequeKeysDto {
    action: PdcStatus.RETURNED | PdcStatus.CANCELLED;
    reason: string;
    remarks?: string | null;
}
