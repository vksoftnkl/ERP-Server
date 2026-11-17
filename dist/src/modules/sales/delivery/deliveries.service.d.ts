import { PrismaService } from '../../../database/prisma/prisma.service';
import { SalesContextService } from '../posting/sales-context.service';
import { DeliveryPendingService } from './core/delivery-pending.service';
import { DeliveryStatusService } from './core/delivery-status.service';
import type { DeliveryExceptionsQueryDto, DeliveryModeDto } from './dto/delivery-note.dto';
export declare class DeliveriesService {
    private readonly prisma;
    private readonly salesContext;
    private readonly pending;
    private readonly status;
    constructor(prisma: PrismaService, salesContext: SalesContextService, pending: DeliveryPendingService, status: DeliveryStatusService);
    mode(dto: DeliveryModeDto): Promise<{
        sbId: string;
        sbAccYear: string;
        sbBillRefno: string | null;
        sbDeliveryMode: string;
        sbDeliveryModeBefore: string;
        sbDeliveryStatus: "PENDING" | "OUT" | "NA" | "RETURNED" | "PART" | "DELIVERED";
        changed: boolean;
    }>;
    exceptions(q: DeliveryExceptionsQueryDto): Promise<{
        rows: {
            billId: string;
            billAccYear: string;
            billRefno: string | null;
            billItemId: string;
            lineNo: number;
            itemName: string;
            godownName: string;
            billedQty: string;
            settledQty: string;
            overQty: string;
            lastEvent: {
                kind: string;
                refno: string | null;
                at: string | null;
            } | null;
        }[];
        rights: {
            view: true;
            print: boolean;
            export: boolean;
        };
    }>;
}
