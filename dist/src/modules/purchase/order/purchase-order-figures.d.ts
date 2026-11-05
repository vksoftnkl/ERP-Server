import { Prisma } from '@prisma/client';
import { type CalcLineIn, type CalcOut } from '../common/purchase-calc';
export interface PoLineFigures {
    key: string;
    gross: Prisma.Decimal;
    discAmt: Prisma.Decimal;
    netGross: Prisma.Decimal;
    chrgBeforeTax: Prisma.Decimal;
    chrgAfterTax: Prisma.Decimal;
    offbillShare: Prisma.Decimal;
    taxable: Prisma.Decimal;
    gstPct: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
    amount: Prisma.Decimal;
    landedValue: Prisma.Decimal;
    landedCost: Prisma.Decimal;
    landedCostIncl: Prisma.Decimal;
}
export interface PoTotals {
    gross: Prisma.Decimal;
    netGross: Prisma.Decimal;
    chrgBeforeTax: Prisma.Decimal;
    taxable: Prisma.Decimal;
    tax: Prisma.Decimal;
    net: Prisma.Decimal;
    chrgAfterTax: Prisma.Decimal;
    chargeTax: Prisma.Decimal;
    offbill: Prisma.Decimal;
    chargesTotal: Prisma.Decimal;
    chargesEstimate: Prisma.Decimal;
    amount: Prisma.Decimal;
    landedValue: Prisma.Decimal;
    poTotal: Prisma.Decimal;
}
export declare function poGoodsValue(lines: CalcLineIn[], interState: boolean): {
    taxable: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    value: Prisma.Decimal;
};
export declare function poFigures(calc: CalcOut, lines: {
    qty: Prisma.Decimal.Value;
    freeQty?: Prisma.Decimal.Value | null;
}[]): {
    lines: PoLineFigures[];
    totals: PoTotals;
};
