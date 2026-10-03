import { TxnHoldDocType, TxnHoldKind, TxnHoldPartyType, TxnHoldSrcModule, TxnHoldStatus } from '../types/txn-hold-api.types';
export declare class TxnHoldErrorFieldDto {
    field: string;
    message: string;
}
export declare class TxnHoldErrorResponseDto {
    success: false;
    message: string;
    errors: TxnHoldErrorFieldDto[];
}
export declare class TxnHoldPayloadDto {
    txhId: string;
    txhCompanyId: string;
    txhBranchId: string;
    txhTenantId: string | null;
    txhAccYear: string;
    txhKind: TxnHoldKind;
    txhSrcModule: TxnHoldSrcModule;
    txhDocType: TxnHoldDocType;
    txhHoldNo: string | null;
    txhHoldSlno: number | null;
    txhHoldOn: string;
    txhDeviceId: string;
    txhCounterId: string | null;
    txhSessionId: string | null;
    txhHeldBy: string;
    txhPartyType: TxnHoldPartyType | null;
    txhPartyId: string | null;
    txhPartyName: string | null;
    txhPartyMobile: string | null;
    txhStaffId: string | null;
    txhRefLabel: string | null;
    txhItemCount: number;
    txhTotalQty: number;
    txhNetAmount: number;
    txhPayload: unknown;
    txhPayloadVersion: number;
    txhRevision: number;
    txhStatus: TxnHoldStatus;
    txhHoldReason: string | null;
    txhRemarks: string | null;
    txhExpiresOn: string | null;
    txhLockedBy: string | null;
    txhLockedDeviceId: string | null;
    txhLockedOn: string | null;
    txhLockExpiresOn: string | null;
    txhLockToken: string | null;
    txhResumedBy: string | null;
    txhResumedOn: string | null;
    txhResumeCount: number;
    txhConvertedDocId: string | null;
    txhConvertedAccYear: string | null;
    txhConvertedRefno: string | null;
    txhConvertedOn: string | null;
    txhConvertedBy: string | null;
    txhIsStockReserved: boolean;
    txhPrintCount: number;
    txhLastPrintedOn: string | null;
    txhIsDeleted: boolean;
    txhSyncDate: string | null;
    txhCreatedOn: string;
    txhCreatedBy: string;
    txhModifiedOn: string | null;
    txhModifiedBy: string | null;
}
export declare class TxnHoldListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class TxnHoldDeleteResultDto {
    txhId: string;
    deleted: true;
}
export declare class TxnHoldSuccessSingleDto {
    success: true;
    message: string;
    data: TxnHoldPayloadDto;
}
export declare class TxnHoldSuccessListDto {
    success: true;
    message: string;
    data: TxnHoldPayloadDto[];
    meta: TxnHoldListMetaDto;
}
export declare class TxnHoldSuccessDeleteDto {
    success: true;
    message: string;
    data: TxnHoldDeleteResultDto;
}
