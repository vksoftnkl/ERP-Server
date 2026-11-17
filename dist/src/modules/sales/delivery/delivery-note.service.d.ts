import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SalesContextService } from '../posting/sales-context.service';
import { TransportBandService } from '../posting/transport-band.service';
import type { RightsBlock } from '../posting/types/posting.types';
import { DeliveryPendingService } from './core/delivery-pending.service';
import { DeliveryStatusService } from './core/delivery-status.service';
import { DeliveryNoteReadService } from './delivery-note-read.service';
import { DeliveryStockCorrectionService } from './delivery-stock-correction.service';
import { type CancelDeliveryNoteDto, type DeliveryNoteKeysDto, type GoodsBackDto, type PostDeliveryNoteDto, type SaveDeliveryNoteDto, type ValidateDeliveryNoteDto } from './dto/delivery-note.dto';
type Tx = Prisma.TransactionClient;
declare const q3: (d: Prisma.Decimal) => string;
export declare class DeliveryNoteService {
    private readonly prisma;
    private readonly salesContext;
    private readonly pending;
    private readonly status;
    private readonly corrections;
    private readonly reader;
    private readonly transportBand;
    private readonly audit;
    constructor(prisma: PrismaService, salesContext: SalesContextService, pending: DeliveryPendingService, status: DeliveryStatusService, corrections: DeliveryStockCorrectionService, reader: DeliveryNoteReadService, transportBand: TransportBandService, audit: AuditLogService);
    rights(client?: Tx): Promise<RightsBlock>;
    private assertRight;
    get(q: {
        companyId: string;
        branchId: string;
        accYear: string;
        sdnId: string;
    }): Promise<Record<string, unknown>>;
    scan(q: {
        companyId: string;
        branchId: string;
        godownId: string;
        code: string;
    }): Promise<{
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
    }>;
    openLines(q: {
        companyId: string;
        branchId: string;
        godownId: string;
        bills: {
            billId: string;
            billAccYear: string;
        }[];
    }): Promise<{
        bills: import("./delivery-note-read.service").DeliveryBillView[];
        lines: import("./delivery-note-read.service").DeliveryLineView[];
        elsewhere: import("./delivery-note-read.service").DeliveryElsewhereView[];
    }>;
    lots(q: {
        companyId: string;
        branchId: string;
        godownId: string;
        itemId: string;
        bucket?: string;
    }): Promise<{
        lots: {
            lotId: string;
            lotNo: string | null;
            expiryDate: string | null;
            owned: string;
            notDelivered: string;
            physical: string;
        }[];
        unit: string;
    }>;
    save(dto: SaveDeliveryNoteDto): Promise<Record<string, unknown>>;
    validate(dto: ValidateDeliveryNoteDto): Promise<Record<string, unknown>>;
    post(dto: PostDeliveryNoteDto): Promise<Record<string, unknown>>;
    cancel(dto: CancelDeliveryNoteDto): Promise<Record<string, unknown>>;
    delete(dto: DeliveryNoteKeysDto): Promise<{
        sdnId: string;
        deleted: true;
    }>;
    goodsBack(dto: GoodsBackDto): Promise<Record<string, unknown>>;
    private keysOf;
    private lockNote;
    private findForWrite;
    private lineIdFinding;
    private frozenAt;
    private assertNotFrozen;
    private assertUndoAboveReturned;
    private lockBills;
    private assertDraft;
    private resolve;
    private writeDraft;
    private outByLine;
    private correctionDoc;
    private correctionLineOf;
    private step;
    private revision;
}
export declare function parseQty(v: string | number | null | undefined): Prisma.Decimal | null;
export declare function istToday(now?: Date): string;
export declare function accYearOf(ymdText: string): string;
export { q3 };
