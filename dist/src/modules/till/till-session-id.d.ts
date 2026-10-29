import type { Prisma } from '@prisma/client';
export declare function tillSessionIdOrNull(client: Pick<Prisma.TransactionClient, 'tillSession'>, sessionId: string | null | undefined): Promise<string | null | undefined>;
