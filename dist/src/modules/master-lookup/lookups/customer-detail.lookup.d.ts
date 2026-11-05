import { PrismaService } from '../../../database/prisma/prisma.service';
import { CustomerDetailQueryDto } from '../dto/customer-detail-query.dto';
import { CustomerDetail } from '../types/master-lookup-api.types';
export declare class CustomerDetailLookup {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getCustomerDetail(query: CustomerDetailQueryDto): Promise<CustomerDetail>;
}
