import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { type MenuRights } from '../../../common/posting/rights';
import type { VoucherRights, VoucherTypeRules, VoucherTypeWithRights } from './types/vouchers-api.types';
type Client = Prisma.TransactionClient | PrismaService;
export declare class VoucherTypesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    loadRegisterTypes(client?: Client): Promise<VoucherTypeRules[]>;
    loadTypeByCode(client: Client, typeCode: string): Promise<VoucherTypeRules | null>;
    loadTypeById(client: Client, typeId: number): Promise<VoucherTypeRules | null>;
    rightsFor(client: Client, userId: string | null, type: VoucherTypeRules): Promise<VoucherRights>;
    typesForCaller(userId: string | null, menuId: number | null, client?: Client): Promise<VoucherTypeWithRights[]>;
    private withGroupNames;
}
export declare function toVoucherRights(r: MenuRights): VoucherRights;
export {};
