import { Prisma } from '@prisma/client';
export declare function unitKgOf(raw: Prisma.Decimal | null | undefined): Prisma.Decimal;
export declare function lineWeightKg(qty: Prisma.Decimal, raw: Prisma.Decimal | null | undefined): Prisma.Decimal;
export declare function unitKgText(raw: Prisma.Decimal | null | undefined): string;
