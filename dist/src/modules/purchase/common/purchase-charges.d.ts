import { Prisma } from '@prisma/client';
import type { CalcChargeIn } from './purchase-calc';
export interface PurchaseChargeMaster {
    chg_id: string;
    chg_name: string;
    chg_type: string;
    chg_method: string;
    chg_default_rate: Prisma.Decimal | null;
    chg_cost_alloc: string | null;
    chg_before_tax: boolean;
    chg_tax_apl: boolean;
    chg_landing_cost: boolean;
    chg_on_bill: boolean;
    chg_ledger_code: string;
    chg_role: string | null;
    tax_rate_perc: Prisma.Decimal | null;
    chg_tax_id: string | null;
}
export declare function loadPurchaseChargeMasters(db: {
    $queryRaw: Prisma.TransactionClient['$queryRaw'];
}, ids: string[]): Promise<Map<string, PurchaseChargeMaster>>;
export declare function purchaseChargeInput(m: PurchaseChargeMaster, keyed: {
    rate?: number | null;
    amount?: number | null;
    payees?: {
        partyId: string;
        amount?: number | null;
    }[] | null;
}, key: string): CalcChargeIn;
