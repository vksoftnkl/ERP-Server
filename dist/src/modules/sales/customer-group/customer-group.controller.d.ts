import { SaveCustomerGroupDto } from './dto/save-customer-group.dto';
import { CustomerGroupService } from './customer-group.service';
import { CustomerGroupPayload, CustomerGroupSuccessResponse } from './types/customer-group-api.types';
export declare class CustomerGroupController {
    private readonly customerGroupService;
    constructor(customerGroupService: CustomerGroupService);
    save(saveCustomerGroupDto: SaveCustomerGroupDto): Promise<CustomerGroupSuccessResponse<CustomerGroupPayload>>;
    getById(cgrId: string): Promise<CustomerGroupSuccessResponse<CustomerGroupPayload>>;
    remove(cgrId: string): Promise<CustomerGroupSuccessResponse<{
        cgrId: string;
        deleted: true;
    }>>;
}
