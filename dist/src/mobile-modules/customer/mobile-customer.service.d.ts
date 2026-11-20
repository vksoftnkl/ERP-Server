import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { type BooksScope, type LedgerFilter } from '../../modules/reports/common/voucher-books.sql';
import { type SqlScope } from '../../modules/reports/party-outstanding/party-outstanding.sql';
import { CustomerService } from '../../modules/sales/customer/customer.service';
import { ListMobileCustomersQueryDto } from './dto/mobile-customer.dto';
import type { MobileCustomerBalanceStatus, MobileCustomerDetail, MobileCustomerFilter, MobileCustomerFormOptions, MobileCustomerListPayload } from './types/mobile-customer-api.types';
export interface MobileBalanceScope extends BooksScope {
    asOn: string;
}
type Num = Prisma.Decimal | string | number;
export declare function escapeLike(term: string): string;
export declare function searchSql(raw: string | undefined): Prisma.Sql;
export declare function filterSql(filter: MobileCustomerFilter): Prisma.Sql;
export declare function balancesSql(scope: MobileBalanceScope | null, ledgers: LedgerFilter): Prisma.Sql;
export declare function outstandingScope(scope: MobileBalanceScope, partyId: string | null, today?: string): SqlScope;
export declare function outstandingSql(scope: MobileBalanceScope | null, partyId: string | null): Prisma.Sql;
export declare function balanceStatusOf(bal: Num | null, creditAmtLimit: Num | null): MobileCustomerBalanceStatus | null;
export declare class MobileCustomerService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly customerService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, customerService: CustomerService);
    list(q: ListMobileCustomersQueryDto): Promise<MobileCustomerListPayload>;
    getById(cusId: string): Promise<MobileCustomerDetail>;
    formOptions(): Promise<MobileCustomerFormOptions>;
    private balanceScope;
    private toListItem;
}
export {};
