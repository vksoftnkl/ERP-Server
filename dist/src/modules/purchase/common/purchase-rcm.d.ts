import type { Tx } from './purchase-doc.helpers';
export declare const RCM_UNREGISTERED_NOTIFIED = "RCM_UNREGISTERED_NOTIFIED";
export declare function assertNoUnregisteredRcm(tx: Tx, a: {
    companyId: string;
    supplierId: string;
    docDate: string;
}, lines: {
    lineNo: number;
    itemId: string;
}[]): Promise<void>;
