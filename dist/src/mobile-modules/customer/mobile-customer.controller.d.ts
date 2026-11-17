import { DataChangeService } from '../../common/data-changes/data-change.service';
import type { PartyDeleteCheck } from '../../common/party/party-balance.service';
import { CustomerService } from '../../modules/sales/customer/customer.service';
import type { CustomerSavePayload, CustomerSuccessResponse } from '../../modules/sales/customer/types/customer-api.types';
import { CreateMobileCustomerDto, ListMobileCustomersQueryDto, UpdateMobileCustomerDto } from './dto/mobile-customer.dto';
import { MobileCustomerService } from './mobile-customer.service';
import type { MobileCustomerDetail, MobileCustomerFormOptions, MobileCustomerListPayload } from './types/mobile-customer-api.types';
type SessionRequest = {
    user?: {
        sid?: string | null;
    };
};
export declare class MobileCustomerController {
    private readonly mobileCustomerService;
    private readonly customerService;
    private readonly dataChangeService;
    constructor(mobileCustomerService: MobileCustomerService, customerService: CustomerService, dataChangeService: DataChangeService);
    list(query: ListMobileCustomersQueryDto): Promise<CustomerSuccessResponse<MobileCustomerListPayload>>;
    options(): Promise<CustomerSuccessResponse<MobileCustomerFormOptions>>;
    getById(cusId: string): Promise<CustomerSuccessResponse<MobileCustomerDetail>>;
    create(dto: CreateMobileCustomerDto, request: SessionRequest): Promise<CustomerSuccessResponse<CustomerSavePayload>>;
    update(dto: UpdateMobileCustomerDto, request: SessionRequest): Promise<CustomerSuccessResponse<CustomerSavePayload>>;
    deleteCheck(cusId: string): Promise<CustomerSuccessResponse<PartyDeleteCheck>>;
    remove(cusId: string): Promise<CustomerSuccessResponse<{
        cusId: string;
        deleted: true;
    }>>;
    private announceOtherRole;
}
export {};
