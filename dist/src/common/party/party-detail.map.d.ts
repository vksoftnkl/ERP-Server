export interface PartyDetailField {
    cus: string | null;
    sup: string | null;
    led: string;
    max: number | null;
}
export declare const PARTY_DETAIL_FIELDS: readonly PartyDetailField[];
export declare const PARTY_REQUIRED_FIELDS: readonly PartyDetailField[];
export type PartyRole = 'CUSTOMER' | 'SUPPLIER';
export declare function roleKeyOf(field: PartyDetailField, role: PartyRole): string | null;
