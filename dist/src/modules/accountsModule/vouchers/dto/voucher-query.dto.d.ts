export declare class VoucherTypesQueryDto {
    companyId: string;
    menuId?: number;
}
export declare class LedgerPickQueryDto {
    companyId: string;
    branchId: string;
    typeCode: string;
    side: 'DR' | 'CR';
    q?: string;
    limit?: number;
}
export declare class LedgerBalanceQueryDto {
    companyId: string;
    branchId?: string | null;
    accYear: string;
    ledgerId: string;
    asOn: string;
}
export declare class PartyFactsQueryDto {
    companyId: string;
    partyId: string;
    asOn: string;
}
export declare class OpenBillsQueryDto {
    companyId: string;
    partyId: string;
    side: 'DR' | 'CR';
}
export declare class TaxRatesQueryDto {
    companyId: string;
    includeInactive?: string;
}
