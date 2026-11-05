export type ChargeCarryBasis = 'PRORATA' | 'FULL' | 'MANUAL' | 'NONE';
export interface ChargeCarryProposal {
    srcChargeId: string;
    srcAccYear: string;
    chargeId: string | null;
    chargeName: string | null;
    amount: number;
    alreadyCarried: number;
    remaining: number;
    basis: ChargeCarryBasis;
    proposed: number;
    completesOrder: boolean;
}
export interface ChargeCarryRow {
    srcChargeId: string | null;
    srcAccYear: string | null;
    amount: number;
    basis?: ChargeCarryBasis;
}
