declare class MobileBankDto {
    bankId: string;
    name: string;
    shortName: string | null;
}
declare class MobileBankListDto {
    items: MobileBankDto[];
    total: number;
}
export declare class MobileBankListSuccessDto {
    success: true;
    message: string;
    data: MobileBankListDto;
}
export {};
