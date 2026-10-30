import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { VoucherPostingService } from "../../../common/posting/voucher-posting.service";
import { TillEventService } from '../../till/services/till-event.service';
import type { ResolveSettlementLineDto, WriteOffTenderDto } from './dto/tender-settlement.dto';
import { TenderSettlementService, type SettlementCaller } from './tender-settlement.service';
import type { SettlementResolvePayload, WriteOffPayload } from './types/tender-settlement-api.types';
export declare class TenderSettlementExceptionService {
    private readonly prisma;
    private readonly requestContext;
    private readonly posting;
    private readonly events;
    private readonly settlement;
    constructor(prisma: PrismaService, requestContext: RequestContextService, posting: VoucherPostingService, events: TillEventService, settlement: TenderSettlementService);
    resolve(dto: ResolveSettlementLineDto): Promise<SettlementResolvePayload>;
    writeOff(dto: WriteOffTenderDto): Promise<WriteOffPayload>;
    private requireOverride;
    private requireReason;
    private chargebackOf;
    private recoveryLedger;
    private incomeLedger;
    private realSession;
}
export type { SettlementCaller };
