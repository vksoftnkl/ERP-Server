import type { Prisma } from '@prisma/client';
import type { BillLegInput, ReturnLegInput, SalesLeg, TenderLegInput } from './types/sales-leg.types';
export declare function chargePostsSeparately(c: {
    cdSepPost?: boolean | null;
    cdBeforeTax?: boolean | null;
}): boolean;
export declare function chargeInsideTaxable(c: {
    cdBeforeTax?: boolean | null;
    cdTaxApl?: boolean | null;
}): boolean;
type ChargeFigure = Prisma.Decimal | number | string | bigint | null | undefined;
export interface SignedChargeFigures {
    amount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
}
export declare function signedCharge(c: {
    cdType?: string | null;
    cdAmount?: ChargeFigure;
    cdCgstAmt?: ChargeFigure;
    cdSgstAmt?: ChargeFigure;
    cdIgstAmt?: ChargeFigure;
    cdCessAmt?: ChargeFigure;
}): SignedChargeFigures;
export declare function splitRegisterCharges(nets: number[]): {
    other: number;
    deduction: number;
};
export declare function buildBillLegs(input: BillLegInput): SalesLeg[];
export declare function buildReturnLegs(input: ReturnLegInput): SalesLeg[];
export declare function buildCogsLegs(cogsAmount: number, direction?: 'ISSUE' | 'RETURN'): SalesLeg[];
export declare function buildTenderLegs(tender: TenderLegInput, partyLedgerId: string, direction?: 'BILL' | 'RETURN'): SalesLeg[];
export {};
