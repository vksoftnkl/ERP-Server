import { DeliveriesService } from './deliveries.service';
import { DeliveryExceptionsQueryDto, DeliveryModeDto } from './dto/delivery-note.dto';
export declare class DeliveriesController {
    private readonly service;
    constructor(service: DeliveriesService);
    mode(dto: DeliveryModeDto): Promise<{
        success: true;
        message: string;
        data: {
            sbId: string;
            sbAccYear: string;
            sbBillRefno: string | null;
            sbDeliveryMode: string;
            sbDeliveryModeBefore: string;
            sbDeliveryStatus: "PENDING" | "OUT" | "NA" | "RETURNED" | "PART" | "DELIVERED";
            changed: boolean;
        };
    }>;
    exceptions(q: DeliveryExceptionsQueryDto): Promise<{
        success: true;
        message: string;
        data: {
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
        };
    }>;
}
