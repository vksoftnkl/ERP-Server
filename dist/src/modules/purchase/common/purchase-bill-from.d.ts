import type { Tx } from './purchase-doc.helpers';
export interface BillFromRow {
    addr_id: string | null;
    gstin: string;
    state_code: string | null;
    state_name: string | null;
    name: string | null;
    addr: string | null;
    place: string | null;
    pin: string | null;
    is_default: boolean;
    source: 'MASTER' | 'LEDGER_ADDRESS';
}
export declare function supplierBillFrom(db: Tx, supplierId: string): Promise<BillFromRow[]>;
