import { Prisma } from '@prisma/client';
export declare function databaseToday(client: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<string>;
export declare function toDateColumn(day: string): Date;
export declare function priceRowsInForce(day: string): Prisma.ItemPriceMasterWhereInput;
export declare function priceRowsScheduledAfter(day: string): Prisma.ItemPriceMasterWhereInput;
