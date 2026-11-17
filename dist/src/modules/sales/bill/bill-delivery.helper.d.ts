import { Prisma } from '@prisma/client';
import type { SalesRefusal } from '../posting/types/posting.types';
import { type DeliveryMode } from '../delivery/core/delivery.constants';
import type { BillLineFacts } from '../delivery/core/delivery-pending.service';
export declare function isDeliveryMode(v: unknown): v is DeliveryMode;
export declare function posDeliveryModeRefusal(billMode: string | null | undefined, requestedMode: string | null | undefined): SalesRefusal | null;
export declare function assertPosDeliveryMode(billMode: string | null | undefined, requestedMode: string | null | undefined): void;
export declare function resolveBillDeliveryMode(tx: Prisma.TransactionClient, input: {
    billMode: string | null | undefined;
    vchrTypeId: number | null | undefined;
    requested: string | null | undefined;
    srcDocType?: string | null;
    srcDocId?: string | null;
    items?: readonly {
        sbiSrcDocType?: string | null;
        sbiSrcDocId?: string | null;
    }[] | null;
}): Promise<DeliveryMode>;
export declare function voucherTypeDeliveryMode(client: Prisma.TransactionClient, vchrTypeId: number): Promise<DeliveryMode>;
export declare function assertAmendKeepsDelivery(bill: {
    sbDeliveryMode: string;
    sbBillRefno: string | null;
}, requestedMode: string | null | undefined, lines: readonly BillLineFacts[], newItems: readonly {
    sbiId?: string | null;
    sbiItemId?: string | null;
    sbiItemUnitId?: string | null;
    sbiGodownId?: string | null;
    sbiLotId?: string | null;
    sbiBucket?: string | null;
    sbiBillQty?: string | number | null;
}[], names: ReadonlyMap<string, {
    itemName: string;
    unitName: string;
}>): void;
export declare function assertNothingGiven(bill: {
    sbBillRefno: string | null;
}, lines: readonly BillLineFacts[], lastNote: {
    refno: string | null;
    date: string | null;
} | null): void;
export declare function deliveryLineNames(tx: Prisma.TransactionClient, billItemIds: readonly string[]): Promise<Map<string, {
    itemName: string;
    unitName: string;
}>>;
export declare function istDateText(at: Date | null | undefined): string;
