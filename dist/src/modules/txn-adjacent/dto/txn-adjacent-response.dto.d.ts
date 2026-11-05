import { type TxnDocType } from '../txn-adjacent.registry';
export declare class TxnAdjacentDocDto {
    docId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    typeCode: string;
    refno: string | null;
    date: string;
    status: string;
}
export declare class TxnAdjacentPayloadDto {
    docType: TxnDocType;
    direction: 'prev' | 'next';
    fromDocId: string | null;
    doc: TxnAdjacentDocDto | null;
}
export declare class TxnAdjacentSuccessDto {
    success: true;
    message: string;
    data: TxnAdjacentPayloadDto;
}
export declare class TxnAdjacentErrorDetailDto {
    field: string;
    message: string;
    code: string;
}
export declare class TxnAdjacentErrorResponseDto {
    success: false;
    message: string;
    errors: TxnAdjacentErrorDetailDto[];
}
