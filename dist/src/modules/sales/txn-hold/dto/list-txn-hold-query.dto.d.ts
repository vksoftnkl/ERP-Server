import { TxnHoldDocType, TxnHoldKind, TxnHoldPartyType, TxnHoldSrcModule, TxnHoldStatus } from '../types/txn-hold-api.types';
export declare class ListTxnHoldQueryDto {
    search?: string;
    txhCompanyId?: string;
    txhBranchId?: string;
    txhAccYear?: string;
    txhKind?: TxnHoldKind;
    txhSrcModule?: TxnHoldSrcModule;
    txhDocType?: TxnHoldDocType;
    txhStatus?: TxnHoldStatus;
    txhDeviceId?: string;
    txhCounterId?: string;
    txhSessionId?: string;
    txhHeldBy?: string;
    txhPartyType?: TxnHoldPartyType;
    txhPartyId?: string;
    txhPartyMobile?: string;
    txhStaffId?: string;
    holdOnFrom?: string;
    holdOnTo?: string;
    expired?: boolean;
    stockReserved?: boolean;
    page?: number;
    limit?: number;
}
