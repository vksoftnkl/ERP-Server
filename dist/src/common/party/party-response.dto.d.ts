export declare class PartySyncDto {
    otherRole: 'CUSTOMER' | 'SUPPLIER' | null;
    otherRoleUpdated: boolean;
    fields: string[];
}
export declare class PartyDeleteBalanceDto {
    companyId: string;
    companyName: string | null;
    amount: string;
    drCr: 'DR' | 'CR';
}
export declare class PartyDeleteWarningsDto {
    draftDocs: number;
    openBills: number;
    chequesInHand: number;
}
export declare class PartyUserWordingDto {
    title: string;
    line: string;
    todo: string;
}
export declare class PartyRefusalDto {
    field: string;
    code: string;
    message: string;
    user?: PartyUserWordingDto;
}
export declare class PartyDeleteCheckDto {
    partyId: string;
    role: 'CUSTOMER' | 'SUPPLIER';
    otherRoleLive: boolean;
    ledgerWouldBeDeleted: boolean;
    canDelete: boolean;
    refusalCode: string | null;
    balances: PartyDeleteBalanceDto[];
    warnings: PartyDeleteWarningsDto;
    refusals: PartyRefusalDto[];
}
export declare class PartyDeleteCheckSuccessDto {
    success: true;
    message: string;
    data: PartyDeleteCheckDto;
}
