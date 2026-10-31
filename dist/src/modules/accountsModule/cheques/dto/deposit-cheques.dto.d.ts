import { ChequeRefDto } from './cheque-keys.dto';
export declare class DepositChequesDto {
    cheques: ChequeRefDto[];
    apdCompanyId: string;
    apdBranchId: string;
    bankLedgerId: string;
    depositDate: string;
    slipNo: string;
    remarks?: string | null;
}
