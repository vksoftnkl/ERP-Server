import { ChequeKeysDto } from './cheque-keys.dto';
export declare class ListChequesQueryDto {
    apdCompanyId: string;
    apdBranchId: string;
    apdAccYear: string;
    status?: string;
    from?: string;
    to?: string;
    bankLedgerId?: string;
    partyId?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
export declare class GetChequeQueryDto extends ChequeKeysDto {
}
export declare class ChequeHistoryQueryDto extends ChequeKeysDto {
}
export declare class DepositSlipQueryDto {
    apdCompanyId: string;
    apdBranchId: string;
    bankLedgerId: string;
    depositDate: string;
    slipNo: string;
}
