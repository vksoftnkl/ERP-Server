import { DeliveryNoteService } from './delivery-note.service';
import { CancelDeliveryNoteDto, DeliveryLotsQueryDto, DeliveryNoteGetQueryDto, DeliveryNoteKeysDto, DeliveryScanQueryDto, GoodsBackDto, OpenLinesDto, PostDeliveryNoteDto, SaveDeliveryNoteDto, ValidateDeliveryNoteDto } from './dto/delivery-note.dto';
export declare class DeliveryNotesController {
    private readonly service;
    constructor(service: DeliveryNoteService);
    save(dto: SaveDeliveryNoteDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    validate(dto: ValidateDeliveryNoteDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    post(dto: PostDeliveryNoteDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    get(q: DeliveryNoteGetQueryDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    cancel(dto: CancelDeliveryNoteDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    remove(dto: DeliveryNoteKeysDto): Promise<{
        success: true;
        message: string;
        data: {
            sdnId: string;
            deleted: true;
        };
    }>;
    goodsBack(dto: GoodsBackDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    scan(q: DeliveryScanQueryDto): Promise<{
        success: true;
        message: string;
        data: {
            kind: "NOTE";
            bill: null;
            bills: never[];
            lines: never[];
            elsewhere: never[];
            note: {
                sdnId: string;
                sdnAccYear: string;
                sdnRefno: string;
            };
        } | {
            kind: "BILL";
            bill: {
                billId: string;
                billAccYear: string;
                billRefno: string | null;
                custName: string | null;
                mode: string;
            };
            bills: import("./delivery-note-read.service").DeliveryBillView[];
            lines: import("./delivery-note-read.service").DeliveryLineView[];
            elsewhere: import("./delivery-note-read.service").DeliveryElsewhereView[];
            note: null;
        };
    }>;
    openLines(dto: OpenLinesDto): Promise<{
        success: true;
        message: string;
        data: {
            bills: import("./delivery-note-read.service").DeliveryBillView[];
            lines: import("./delivery-note-read.service").DeliveryLineView[];
            elsewhere: import("./delivery-note-read.service").DeliveryElsewhereView[];
        };
    }>;
    lots(q: DeliveryLotsQueryDto): Promise<{
        success: true;
        message: string;
        data: {
            lots: {
                lotId: string;
                lotNo: string | null;
                expiryDate: string | null;
                owned: string;
                notDelivered: string;
                physical: string;
            }[];
            unit: string;
        };
    }>;
}
