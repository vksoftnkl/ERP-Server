import { Prisma } from '@prisma/client';
import type { DeliveryEventKind } from './delivery.constants';
export interface DeliveryEventQty {
    settleQty: Prisma.Decimal;
    settleBaseQty: Prisma.Decimal;
    outQty: Prisma.Decimal;
    outBaseQty: Prisma.Decimal;
}
export declare function deliveryEventQty(kind: DeliveryEventKind, qty: Prisma.Decimal, base: Prisma.Decimal): DeliveryEventQty;
export declare function lineFigures(billed: Prisma.Decimal, events: readonly Pick<DeliveryEventQty, 'settleQty' | 'outQty'>[]): {
    settled: Prisma.Decimal;
    given: Prisma.Decimal;
    pending: Prisma.Decimal;
};
