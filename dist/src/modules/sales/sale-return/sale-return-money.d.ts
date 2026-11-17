import { Prisma } from '@prisma/client';
export type Dec = Prisma.Decimal;
export declare const D: (v: Prisma.Decimal.Value | null | undefined) => Dec;
export declare const ZERO: Prisma.Decimal;
export declare const ONE: Prisma.Decimal;
export declare const r2: (v: Dec) => Dec;
export declare const r3: (v: Dec) => Dec;
export declare const r4: (v: Dec) => Dec;
export declare const r6: (v: Dec) => Dec;
export declare function resolveFactor(lineFactor: Prisma.Decimal.Value | null | undefined, unitFactor: Prisma.Decimal.Value | null | undefined): Dec;
export declare const MONEY_PARTS: readonly ["grossAmt", "itemDiscAmt", "splDiscAmt", "schDiscAmt", "billSchAmt", "addlDisc1Amt", "addlDisc2Amt", "cashDiscAmt", "taxableAmt", "cgstAmt", "sgstAmt", "igstAmt", "cessAmt", "acessAmt", "cogsAmt"];
export declare const FINE_PARTS: readonly ["netGross", "chrgBeforeTax", "loyaltyPv", "loyaltyPoints"];
export declare const QTY_PARTS: readonly ["weightQty"];
export type PartKey = (typeof MONEY_PARTS)[number] | (typeof FINE_PARTS)[number] | (typeof QTY_PARTS)[number];
export declare const ALL_PARTS: readonly PartKey[];
export type LineParts = Record<PartKey, Dec>;
export declare function zeroParts(): LineParts;
export declare function addParts(a: LineParts, b: LineParts): LineParts;
export declare const PER_UNIT_FIGURES: readonly ["rate", "ratePreTax", "maxPrice", "minPrice", "actPrice", "itemDiscQty", "splDiscQty", "schDiscQty", "billSchQty", "cessPerUnit", "acessPerUnit"];
export declare const PERCENT_FIGURES: readonly ["itemDiscPerc", "splDiscPerc", "schDiscPerc", "billSchPerc", "addlDisc1Perc", "addlDisc2Perc", "cashDiscPerc", "taxPerc", "cgstPerc", "sgstPerc", "igstPerc", "cessPerc", "acessPerc"];
export type PerUnitKey = (typeof PER_UNIT_FIGURES)[number];
export type PercentKey = (typeof PERCENT_FIGURES)[number];
export interface BillLineCopy {
    hsnCode: string | null;
    taxId: string | null;
    isTaxIncl: boolean;
    isFree: boolean;
    freeType: string | null;
    isService: boolean;
    schemeId: string | null;
    schemeName: string | null;
    priceLevel: number | null;
    eanCode: string | null;
    lotId: string | null;
    batchNo: string | null;
    batchDate: string | null;
    expiryDate: string | null;
    serialNo: string | null;
    salesmanId: string | null;
    promoUsageId: string | null;
    qtyPriceId: string | null;
    size: string | null;
    sizeUom: string | null;
}
export interface BillLineFacts {
    billItemId: string;
    accYear: string;
    lineNo: number;
    itemId: string;
    itemUnitId: string;
    qty: Dec;
    factor: Dec;
    parts: LineParts;
    perUnit: Record<PerUnitKey, Dec | null>;
    percent: Record<PercentKey, Dec>;
    copy: BillLineCopy;
}
export interface PriorBack {
    base: Dec;
    parts: LineParts;
}
export declare const baseOf: (l: Pick<BillLineFacts, "qty" | "factor">) => Dec;
export type RateSourceKind = 'BILL' | 'LAST_SALE' | 'TODAY_PRICE';
export interface RateSource {
    kind: RateSourceKind;
    sbRefno: string | null;
    sbDate: string | null;
    billItemId: string | null;
    accYear: string | null;
}
export interface ReturnLineAsk {
    index: number;
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemUnitId: string;
    qty: Dec;
    factor: Dec;
}
export interface TodayPriceFacts {
    rateWot: Dec;
    rate: Dec;
    taxId: string | null;
    hsnCode: string | null;
    taxPerc: Dec;
    cessPerc: Dec;
    priceLevel: number | null;
}
export interface LineMoney {
    index: number;
    lineNo: number;
    splitNo: number;
    billItemId: string | null;
    billAccYear: string | null;
    billLineNo: number | null;
    itemId: string;
    itemUnitId: string;
    qty: Dec;
    factor: Dec;
    qtyBase: Dec;
    parts: LineParts;
    perUnit: Record<PerUnitKey, Dec | null>;
    percent: Record<PercentKey, Dec>;
    copy: BillLineCopy | null;
    discAmt: Dec;
    taxAmt: Dec;
    netAmt: Dec;
    costPerBase: Dec | null;
    takesRemainder: boolean;
    rateSource: RateSource;
    overQty: boolean;
    leftBaseBefore: Dec | null;
}
export declare function mirrorParts(bill: LineParts, already: LineParts, billBase: Dec, takeBase: Dec, empties: boolean): LineParts;
export declare function scaleParts(src: LineParts, srcBase: Dec, takeBase: Dec): LineParts;
export declare function convertPerUnit(perUnit: Record<PerUnitKey, Dec | null>, billFactor: Dec, askFactor: Dec): Record<PerUnitKey, Dec | null>;
export declare function mirrorBilledLines(bill: {
    refno: string | null;
    date: string | null;
}, billLines: readonly BillLineFacts[], prior: ReadonlyMap<string, PriorBack>, asks: readonly (ReturnLineAsk & {
    billItemId: string;
})[]): LineMoney[];
export declare function emptiesBill(billLines: readonly BillLineFacts[], prior: ReadonlyMap<string, PriorBack>, lines: readonly LineMoney[]): boolean;
export declare function resplitGst(parts: LineParts, percent: Record<PercentKey, Dec>, nature: 'INTRA' | 'INTER'): void;
export declare function lastSaleLine(source: BillLineFacts, sourceBill: {
    refno: string | null;
    date: string | null;
}, ask: ReturnLineAsk, nature?: 'INTRA' | 'INTER'): LineMoney;
export declare function todayPriceLine(price: TodayPriceFacts, ask: ReturnLineAsk, nature: 'INTRA' | 'INTER'): LineMoney;
export interface ChargeFigures {
    amount: Dec;
    cgst: Dec;
    sgst: Dec;
    igst: Dec;
    cess: Dec;
}
export declare const zeroFigures: () => ChargeFigures;
export interface BillChargeFacts {
    cdId: string;
    accYear: string;
    chgId: string;
    name: string | null;
    type: 'ADD' | 'DEDUCT';
    beforeTax: boolean;
    sepPost: boolean;
    taxApl: boolean;
    method: string | null;
    role: string | null;
    applyOn: string | null;
    ledgerId: string;
    ledgerName: string | null;
    taxCode: string | null;
    hsn: string | null;
    unit: string | null;
    taxPerc: Dec;
    cgstPerc: Dec;
    sgstPerc: Dec;
    igstPerc: Dec;
    cessPerc: Dec;
    onBill: ChargeFigures;
    backBefore: ChargeFigures;
}
export interface ChargeAsk {
    giveBack?: boolean | null;
    amount?: Dec | null;
}
export type ChargeKind = 'IN_LINES' | 'CARRIED';
export type ChargeBasis = 'QTY' | 'WEIGHT' | 'VALUE';
export interface ChargeBack {
    bill: BillChargeFacts;
    kind: ChargeKind;
    sign: 1 | -1;
    basis: ChargeBasis;
    giveBack: boolean;
    manual: boolean;
    cap: Dec;
    proposed: Dec;
    back: ChargeFigures;
    takesRemainder: boolean;
    overCap: boolean;
    typed: boolean;
}
export declare function basisOf(method: string | null | undefined): ChargeBasis;
export interface BasisTotals {
    qtyBase: Dec;
    weight: Dec;
    value: Dec;
}
export declare function basisTotals(lines: readonly {
    qtyBase: Dec;
    parts: Pick<LineParts, 'weightQty' | 'netGross' | 'taxableAmt'>;
}[]): BasisTotals;
export declare function mirrorCharges(input: {
    charges: readonly BillChargeFacts[];
    asks: ReadonlyMap<string, ChargeAsk>;
    billBasis: BasisTotals;
    returnBasis: BasisTotals;
    emptiesBill: boolean;
    manual: {
        freight: boolean;
        loading: boolean;
    };
    defaultGiveBack: boolean;
}): ChargeBack[];
export declare const signed: (c: ChargeBack, v: Dec) => Dec;
export interface ReturnTotals {
    gross: Dec;
    itemDisc: Dec;
    splDisc: Dec;
    schDisc: Dec;
    billSchDisc: Dec;
    discAmt: Dec;
    cashDisc: Dec;
    taxable: Dec;
    cgst: Dec;
    sgst: Dec;
    igst: Dec;
    cess: Dec;
    acess: Dec;
    tax: Dec;
    goods: Dec;
    chargesNet: Dec;
    otherAmt: Dec;
    freight: Dec;
    load: Dec;
    unload: Dec;
    roundOff: Dec;
    creditNote: Dec;
    qty: Dec;
    weight: Dec;
    cogs: Dec;
    takesBillRoundOff: boolean;
}
export declare function roundOffFor(subtotal: Dec, step: Dec): Dec;
export declare function totalsOf(input: {
    lines: readonly LineMoney[];
    charges: readonly ChargeBack[];
    cashDisc: Dec;
    roundOffStep: Dec;
    billRoundOffLeft: Dec | null;
}): ReturnTotals;
export declare function everyChargeBack(charges: readonly ChargeBack[]): boolean;
export declare function cashDiscShare(input: {
    billCashDisc: Dec;
    priorCashDisc: Dec;
    billLineTaxable: Dec;
    returnLineTaxable: Dec;
    emptiesBill: boolean;
}): Dec;
export declare const n: (v: Dec | null | undefined) => number | null;
