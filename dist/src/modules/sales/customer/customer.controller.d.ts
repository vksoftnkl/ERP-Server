import { CustomerService } from './customer.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import { CustomerPayload, CustomerSuccessResponse } from './types/customer-api.types';
export declare class CustomerController {
    private readonly customerService;
    constructor(customerService: CustomerService);
    save(saveCustomerDto: SaveCustomerDto): Promise<CustomerSuccessResponse<CustomerPayload>>;
    getById(cusId: string): Promise<CustomerSuccessResponse<CustomerPayload>>;
    remove(cusId: string): Promise<CustomerSuccessResponse<{
        cusId: string;
        deleted: true;
    }>>;
}
