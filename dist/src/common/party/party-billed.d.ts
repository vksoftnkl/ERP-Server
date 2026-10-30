import { Prisma } from '@prisma/client';
export interface LastBilled {
    date: Date | null;
    count: number;
}
type BilledClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
export declare function lastBilledOf(client: BilledClient, cusId: string): Promise<LastBilled>;
export {};
