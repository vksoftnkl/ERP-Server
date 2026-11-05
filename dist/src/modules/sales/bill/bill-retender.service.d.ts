import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { SalesContextService } from '../posting/sales-context.service';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import { BillService } from './bill.service';
import { BillBalanceRecomputeService } from '../../accountsModule/billBalance/bill-balance-recompute.service';
import type { RetenderBillDto } from './dto/bill-lifecycle.dto';
import { type BillPayload } from './types/bill-api.types';
import { TillSessionService } from '../../till/services/till-session.service';
export declare class BillRetenderService {
    private readonly prisma;
    private readonly bills;
    private readonly salesContext;
    private readonly tenders;
    private readonly legs;
    private readonly loyalty;
    private readonly audit;
    private readonly recompute;
    private readonly till;
    constructor(prisma: PrismaService, bills: BillService, salesContext: SalesContextService, tenders: TenderDetailService, legs: VoucherPostingService, loyalty: LoyaltyLedgerService, audit: AuditLogService, recompute: BillBalanceRecomputeService, till: TillSessionService);
    retender(dto: RetenderBillDto): Promise<BillPayload>;
    private tenderScope;
}
