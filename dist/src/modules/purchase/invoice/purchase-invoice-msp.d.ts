import { Prisma } from '@prisma/client';
export declare function savedMinPrice(typed: number | null | undefined): Prisma.Decimal | null;
export declare function shownMinPrice(typed: number | null | undefined, current: Prisma.Decimal | null | undefined): Prisma.Decimal | null;
