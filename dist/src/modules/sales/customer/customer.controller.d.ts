import { DataChangeService } from '../../../common/data-changes/data-change.service';
import type { PartyDeleteCheck } from '../../../common/party/party-balance.service';
import { CustomerService } from './customer.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import { CustomerPayload, CustomerSavePayload, CustomerSuccessResponse } from './types/customer-api.types';
export declare class CustomerController {
    private readonly customerService;
    private readonly dataChangeService;
    constructor(customerService: CustomerService, dataChangeService: DataChangeService);
    save(saveCustomerDto: SaveCustomerDto, request: {
        user?: {
            sid?: string | null;
        };
    }): Promise<CustomerSuccessResponse<CustomerSavePayload>>;
    getById(cusId: string): Promise<CustomerSuccessResponse<CustomerPayload>>;
    deleteCheck(cusId: string): Promise<CustomerSuccessResponse<PartyDeleteCheck>>;
    remove(cusId: string): Promise<CustomerSuccessResponse<{
        cusId: string;
        deleted: true;
    }>>;
}
