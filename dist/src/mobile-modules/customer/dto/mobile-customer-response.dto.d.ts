import { CustomerPayloadDto } from "../../../modules/sales/customer/dto/customer-response.dto";
export declare class MobileSidedAmountDto {
    amount: string;
    side: 'DR' | 'CR';
}
export declare class MobileCustomerListItemDto {
    cusId: string;
    cusName: string | null;
    cusShort: string | null;
    cusCode: string | null;
    cusCity: string | null;
    cusAreaName: string | null;
    cusPhone1: string | null;
    cusWhatsappNo: string | null;
    cusGstNo: string | null;
    cusGstType: string | null;
    cusIsActive: boolean;
    cusCreditAmtLimit: string;
    balance: MobileSidedAmountDto | null;
    balanceStatus: string | null;
    outstanding: string | null;
    outstandingBills: number | null;
    oldestBillDate: string | null;
}
export declare class MobileCustomerCountsDto {
    all: number;
    outstanding: number;
    unregistered: number;
    inactive: number;
}
export declare class MobileCustomerListPayloadDto {
    items: MobileCustomerListItemDto[];
    counts: MobileCustomerCountsDto;
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    balanceAsOn: string | null;
    accYear: string | null;
    companyId: string | null;
}
export declare class MobileCustomerListSuccessDto {
    success: true;
    message: string;
    data: MobileCustomerListPayloadDto;
}
export declare class MobileCustomerDetailDto extends CustomerPayloadDto {
    balance: MobileSidedAmountDto | null;
    balanceStatus: string | null;
    outstanding: string | null;
    outstandingBills: number | null;
    oldestBillDate: string | null;
}
export declare class MobileCustomerDetailSuccessDto {
    success: true;
    message: string;
    data: MobileCustomerDetailDto;
}
declare class MobileOptionDto {
    id: string;
    name: string;
}
declare class MobileAreaOptionDto extends MobileOptionDto {
    cityId: string;
    cityName: string | null;
}
declare class MobilePriceLevelOptionDto {
    id: number;
    name: string;
}
declare class MobileStateOptionDto {
    code: string;
    name: string;
}
export declare class MobileCustomerFormOptionsDto {
    areas: MobileAreaOptionDto[];
    groups: MobileOptionDto[];
    priceLevels: MobilePriceLevelOptionDto[];
    states: MobileStateOptionDto[];
    gstTypes: string[];
}
export declare class MobileCustomerFormOptionsSuccessDto {
    success: true;
    message: string;
    data: MobileCustomerFormOptionsDto;
}
export {};
