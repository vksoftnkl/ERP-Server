export interface MobileBank {
    bankId: string;
    name: string;
    shortName: string | null;
}
export interface MobileBankList {
    items: MobileBank[];
    total: number;
}
