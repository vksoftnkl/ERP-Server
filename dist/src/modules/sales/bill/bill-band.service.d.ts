import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SalesContextService } from '../posting/sales-context.service';
import { TransportBandService, type TransportBandRow } from '../posting/transport-band.service';
import { BillService } from './bill.service';
import type { BillTransportDto, UpdateRemarksDto } from './dto/bill-lifecycle.dto';
export declare class BillBandService {
    private readonly prisma;
    private readonly bills;
    private readonly salesContext;
    private readonly transportBand;
    private readonly audit;
    constructor(prisma: PrismaService, bills: BillService, salesContext: SalesContextService, transportBand: TransportBandService, audit: AuditLogService);
    updateRemarks(dto: UpdateRemarksDto): Promise<{
        sbRemarks: string | null;
    }>;
    transport(dto: BillTransportDto): Promise<TransportBandRow>;
    private ref;
    private assertPosted;
    private assertDayOpen;
}
