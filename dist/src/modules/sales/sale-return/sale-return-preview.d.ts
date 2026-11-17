import { Prisma } from '@prisma/client';
import type { DocRow } from '../posting/sales-doc-store';
import { type SalesMessageParams } from '../posting/types/posting.types';
import { type ChargeAsk, type ChargeBack, type Dec, type LineMoney, type PriorBack, type ReturnTotals } from './sale-return-money';
import { SaleReturnBillReader, type BillHeaderFacts, type BillLineView, type BillTenderFacts, type DraftHold, type LotFacts, type PriorHeader, type UnitRow } from './sale-return-bill-reader';
type Client = Prisma.TransactionClient;
export interface MoneyIssue {
    level: 'REFUSE' | 'WARN' | 'INFO';
    code: string;
    message: string;
    field?: string;
    line?: number;
    params?: SalesMessageParams;
}
export interface MoneyInput {
    srId: string | null;
    companyId: string;
    branchId: string;
    custId: string | null;
    returnDate: string;
    againstBill: boolean;
    billId: string | null;
    billAccYear: string | null;
    priceLevel: number | null;
    posStcd: string | null;
    reasonId: string | null;
    items: readonly DocRow[];
    chargeAsks: ReadonlyMap<string, ChargeAsk>;
    settings: {
        returnWindowDays: number;
        roundOffStep: number;
        freeReturnAllowed: boolean;
        freightCalcType: string | null;
        loadingCalcType: string | null;
        expiredLotDays: number;
    };
}
export interface ReturnMoney {
    bill: BillHeaderFacts | null;
    billLines: BillLineView[];
    prior: Map<string, PriorBack>;
    priorHeader: PriorHeader | null;
    drafts: Map<string, DraftHold>;
    units: Map<string, UnitRow>;
    lots: Map<string, LotFacts>;
    lines: LineMoney[];
    charges: ChargeBack[];
    totals: ReturnTotals;
    emptiesBill: boolean;
    nature: 'INTRA' | 'INTER';
    roundOffStep: Dec;
    freightCalcType: string | null;
    loadingCalcType: string | null;
    issues: MoneyIssue[];
}
export declare function buildReturnMoney(reader: SaleReturnBillReader, c: Client, input: MoneyInput): Promise<ReturnMoney>;
export declare function dbDate(iso: string | null | undefined): Date | null;
export declare function lineFieldsOf(l: LineMoney, item: DocRow, headerPriceLevel: number | null): DocRow;
export declare function headerFieldsOf(m: ReturnMoney): DocRow;
export declare function storesCharge(c: ChargeBack): boolean;
export declare function chargeRowsOf(m: ReturnMoney, existing: ReadonlyMap<string, string>): Record<string, unknown>[];
export declare function chargeAsksOfBody(charges: readonly Record<string, unknown>[] | undefined): Map<string, ChargeAsk>;
export declare function chargeAsksOfStored(rows: readonly {
    cdSrcCdId?: string | null;
    cdCarryBasis?: string | null;
    cdAmount?: unknown;
}[]): Map<string, ChargeAsk>;
export declare const bucketOfCondition: (condition: string | null | undefined) => string;
export declare function lineBucketOf(item: DocRow, claim: boolean): string;
export declare function bringsStock(item: DocRow, claim: boolean): boolean;
declare function chargeJson(c: ChargeBack): Record<string, unknown>;
export declare function totalsJson(t: ReturnTotals): Record<string, unknown>;
export declare function previewOf(m: ReturnMoney, items: readonly DocRow[], claim?: boolean): Record<string, unknown>;
export declare function billLinesJson(input: {
    bill: BillHeaderFacts;
    lines: BillLineView[];
    prior: Map<string, PriorBack>;
    drafts: Map<string, DraftHold>;
    itemUnits: Map<string, UnitRow[]>;
    barcodes: Map<string, {
        code: string;
        itemUnitId: string | null;
    }[]>;
    charges: Record<string, unknown>[];
    tenders: BillTenderFacts;
    due: Dec;
    receivedLater: Dec;
    refundCap: Dec;
}): Record<string, unknown>;
export { chargeJson };
