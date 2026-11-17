import type { Prisma } from '@prisma/client';
type RawClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
export declare function voucherTypeCompanyMismatch(message: string): never;
export declare function resolveVoucherTypeCompany(client: RawClient, tokenCompanyId: string | null | undefined, bodyCompanyId: string): Promise<string>;
export {};
