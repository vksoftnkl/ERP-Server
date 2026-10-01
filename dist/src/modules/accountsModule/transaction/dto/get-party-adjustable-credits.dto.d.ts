import { AdjustableCreditSide } from '../types/transaction-api.types';
export declare class GetPartyAdjustableCreditsDto {
    partyId: string;
    companyId: string;
    type?: AdjustableCreditSide;
}
