import { LedGstPartyRegType } from "../../modules/accountsModule/accountLedgerMasters/types/account-ledger-master-enum";
export declare const PARTY_GST_TYPES: readonly ["REGULAR", "COMPOSITION", "SEZ", "OVERSEAS", "UNREGISTERED"];
export type PartyGstType = (typeof PARTY_GST_TYPES)[number];
export declare const OVERSEAS_STATE_CODE = "96";
export declare function normalizePartyGstType(raw: string | null | undefined): PartyGstType | null | 'INVALID';
export declare function ledgerGstFieldsOf(type: PartyGstType): {
    ledGstPartyRegType: LedGstPartyRegType;
    ledIsSez: boolean;
};
export type PartyGstRefusal = {
    kind: 'TYPE_INVALID';
    sent: string;
} | {
    kind: 'TYPE_REQUIRED';
} | {
    kind: 'GSTIN_REQUIRED';
    type: PartyGstType;
} | {
    kind: 'GSTIN_NOT_ALLOWED';
    type: PartyGstType;
} | {
    kind: 'OVERSEAS_STATE';
    stateCode: string;
} | {
    kind: 'GSTIN_STATE_MISMATCH';
    gstin: string;
    gstinState: string;
    stateCode: string;
};
export declare function resolvePartyGstType(input: {
    rawType: string | null | undefined;
    gstin: string | null | undefined;
    stateCode: string;
    checkGstinState?: boolean;
}): {
    type: PartyGstType;
} | {
    refusal: PartyGstRefusal;
};
export declare function partyGstTypeWord(type: PartyGstType): string;
