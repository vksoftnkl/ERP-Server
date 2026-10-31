import { Prisma } from '@prisma/client';
export type ItcClass = 'ELIGIBLE' | 'INELIGIBLE' | 'BLOCKED_17_5' | 'RCM' | 'COMPOSITION' | 'UNREGISTERED';
export type ChargeMethod = 'FIXED' | 'PERCENT' | 'QTY' | 'NET_QTY' | 'KG' | 'QTL' | 'TON';
export type ChargeAlloc = 'VALUE' | 'QTY' | 'WEIGHT' | 'NONE';
export interface CalcLineIn {
    key: string;
    billedQty: Prisma.Decimal.Value;
    receivedQty?: Prisma.Decimal.Value | null;
    damagedQty?: Prisma.Decimal.Value | null;
    freeQty?: Prisma.Decimal.Value | null;
    toBaseFactor?: Prisma.Decimal.Value | null;
    rate: Prisma.Decimal.Value;
    discPct?: Prisma.Decimal.Value | null;
    discPerQty?: Prisma.Decimal.Value | null;
    discAmt?: Prisma.Decimal.Value | null;
    schPct?: Prisma.Decimal.Value | null;
    schPerQty?: Prisma.Decimal.Value | null;
    schAmt?: Prisma.Decimal.Value | null;
    extraDiscAmt?: Prisma.Decimal.Value | null;
    gstPct?: Prisma.Decimal.Value | null;
    cessPct?: Prisma.Decimal.Value | null;
    cessPerUnit?: Prisma.Decimal.Value | null;
    weight?: Prisma.Decimal.Value | null;
    itcClass?: ItcClass | null;
    shortagePct?: Prisma.Decimal.Value | null;
}
export interface CalcChargeIn {
    key: string;
    type: 'ADD' | 'DEDUCT';
    method: ChargeMethod;
    rate: Prisma.Decimal.Value;
    amount?: Prisma.Decimal.Value | null;
    alloc: ChargeAlloc;
    beforeTax: boolean;
    onBill: boolean;
    landingCost: boolean;
    taxPct?: Prisma.Decimal.Value | null;
    payees?: {
        partyId: string;
        amount?: Prisma.Decimal.Value | null;
    }[];
    lineKeys?: string[] | null;
}
export interface CalcIn {
    interState: boolean;
    supplierTaxMode?: 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED' | null;
    lines: CalcLineIn[];
    charges?: CalcChargeIn[];
    tcsAmount?: Prisma.Decimal.Value | null;
    roundOffStep?: Prisma.Decimal.Value | null;
}
export interface CalcLineOut {
    key: string;
    gross: Prisma.Decimal;
    discAmt: Prisma.Decimal;
    schAmt: Prisma.Decimal;
    extraDiscAmt: Prisma.Decimal;
    netGross: Prisma.Decimal;
    chrgBeforeTax: Prisma.Decimal;
    chrgAfterTax: Prisma.Decimal;
    offbillShare: Prisma.Decimal;
    taxable: Prisma.Decimal;
    gstPct: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    total: Prisma.Decimal;
    shortQty: Prisma.Decimal;
    absorbedShortQty: Prisma.Decimal;
    pendingShortQty: Prisma.Decimal;
    itcClass: ItcClass;
    itcEligible: Prisma.Decimal;
    itcPending: Prisma.Decimal;
    itcIneligible: Prisma.Decimal;
    shortValue: Prisma.Decimal;
    landedValue: Prisma.Decimal;
    landedCostWot: Prisma.Decimal;
}
export interface CalcChargeOut {
    key: string;
    amount: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    lineShares: Record<string, Prisma.Decimal>;
    payees: {
        partyId: string;
        amount: Prisma.Decimal;
    }[];
}
export interface CalcOut {
    lines: CalcLineOut[];
    charges: CalcChargeOut[];
    gross: Prisma.Decimal;
    discount: Prisma.Decimal;
    taxable: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    chargesOnBill: Prisma.Decimal;
    chargeTax: Prisma.Decimal;
    tcs: Prisma.Decimal;
    roundOff: Prisma.Decimal;
    netPayable: Prisma.Decimal;
    offbillCharges: Prisma.Decimal;
    shortValue: Prisma.Decimal;
    itcEligible: Prisma.Decimal;
    itcPending: Prisma.Decimal;
    itcIneligible: Prisma.Decimal;
}
export declare function spread(amount: Prisma.Decimal, weights: Prisma.Decimal[]): Prisma.Decimal[];
export declare function calcPurchase(input: CalcIn): CalcOut;
export declare function priceFromMarkup(costWot: Prisma.Decimal.Value, markupPct: Prisma.Decimal.Value, step?: Prisma.Decimal.Value | null): Prisma.Decimal;
export declare function markupOf(costWot: Prisma.Decimal.Value, sellWot: Prisma.Decimal.Value): Prisma.Decimal;
export declare function marginOf(costWot: Prisma.Decimal.Value, sellWot: Prisma.Decimal.Value): Prisma.Decimal;
export declare function rateFromInclusiveCost(costIncl: Prisma.Decimal.Value, gstPct: Prisma.Decimal.Value, cessPct?: Prisma.Decimal.Value | null, cessPerUnit?: Prisma.Decimal.Value | null): Prisma.Decimal;
