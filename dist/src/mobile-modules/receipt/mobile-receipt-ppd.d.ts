import { Prisma } from '@prisma/client';
import { type PpdSlab } from '../../modules/accountsModule/receipt/ppd-slab';
export interface MobilePpdStep {
    tillDate: string;
    perc: string;
    amount: string;
}
export declare function ppdScheduleOf(params: {
    docDate: Date;
    onDate: Date;
    pendingAmount: Prisma.Decimal;
    slabs: readonly PpdSlab[];
}): MobilePpdStep[];
