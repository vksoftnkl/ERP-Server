import type { BillLegInput, ReturnLegInput, SalesLeg, TenderLegInput } from './types/sales-leg.types';
export declare function buildBillLegs(input: BillLegInput): SalesLeg[];
export declare function buildReturnLegs(input: ReturnLegInput): SalesLeg[];
export declare function buildCogsLegs(cogsAmount: number, direction?: 'ISSUE' | 'RETURN'): SalesLeg[];
export declare function buildTenderLegs(tender: TenderLegInput, partyLedgerId: string, direction?: 'BILL' | 'RETURN'): SalesLeg[];
