import { Prisma } from '@prisma/client';
import { type Tx } from './purchase-doc.helpers';
export interface SlabLine {
    rate: number;
    discPct?: number;
    discPerQty?: number;
    schPct?: number;
    schPerQty?: number;
}
export declare function valuePerPiece(l: SlabLine, toBaseFactor: Prisma.Decimal.Value): Prisma.Decimal;
export declare function pickSlab(baseTaxId: string, perPiece: Prisma.Decimal, threshold: Prisma.Decimal.Value | null, aboveTaxId: string | null): string;
export declare function applyValueSlabs(tx: Tx, lines: (SlabLine & {
    uomId: string;
    taxId?: string;
})[], factorOf: (uomId: string) => Prisma.Decimal.Value | undefined): Promise<void>;
