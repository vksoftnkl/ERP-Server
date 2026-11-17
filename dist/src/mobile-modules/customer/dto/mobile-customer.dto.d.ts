import { SaveCustomerDto } from "../../../modules/sales/customer/dto/save-customer.dto";
import { type MobileCustomerFilter } from '../types/mobile-customer-api.types';
export declare const MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE = 50;
export declare const MOBILE_CUSTOMER_MAX_PAGE_SIZE = 200;
export declare class ListMobileCustomersQueryDto {
    search?: string;
    filter?: MobileCustomerFilter;
    page?: number;
    pageSize?: number;
}
declare const CreateMobileCustomerDto_base: import("@nestjs/common").Type<Omit<SaveCustomerDto, "cusId">>;
export declare class CreateMobileCustomerDto extends CreateMobileCustomerDto_base {
}
declare const UpdateMobileCustomerDto_base: import("@nestjs/common").Type<Omit<SaveCustomerDto, "cusId" | "cusLinkLedId">>;
export declare class UpdateMobileCustomerDto extends UpdateMobileCustomerDto_base {
    cusId: string;
}
export {};
