import { type TxnDocType } from '../txn-adjacent.registry';
export declare class TxnAdjacentQueryDto {
    docType: TxnDocType;
    companyId: string;
    branchId: string;
    accYear: string;
    docId?: string;
    direction: 'prev' | 'next';
    typeCode?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
}
