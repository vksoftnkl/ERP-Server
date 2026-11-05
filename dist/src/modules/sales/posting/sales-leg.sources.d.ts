import type { BillLegInput, ReturnLegInput, SalesLeg, TenderLegInput } from './types/sales-leg.types';
export declare function chargePostsSeparately(c: {
    cdSepPost?: boolean | null;
    cdBeforeTax?: boolean | null;
}): boolean;
export declare function splitRegisterCharges(nets: number[]): {
    other: number;
    deduction: number;
};
export declare function buildBillLegs(input: BillLegInput): SalesLeg[];
export declare function buildReturnLegs(input: ReturnLegInput): SalesLeg[];
export declare function buildCogsLegs(cogsAmount: number, direction?: 'ISSUE' | 'RETURN'): SalesLeg[];
export declare function buildTenderLegs(tender: TenderLegInput, partyLedgerId: string, direction?: 'BILL' | 'RETURN'): SalesLeg[];
