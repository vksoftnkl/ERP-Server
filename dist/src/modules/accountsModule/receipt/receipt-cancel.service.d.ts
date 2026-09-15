import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { ReceiptService } from './receipt.service';
import { CancelReceiptDto } from './dto/post-receipt.dto';
import type { ReceiptCancelPayload } from './types/receipt-api.types';
export declare class ReceiptCancelService {
    private readonly prisma;
    private readonly requestContext;
    private readonly receiptService;
    private readonly recompute;
    constructor(prisma: PrismaService, requestContext: RequestContextService, receiptService: ReceiptService, recompute: BillBalanceRecomputeService);
    cancel(dto: CancelReceiptDto): Promise<ReceiptCancelPayload>;
    private assertChequesStillHeld;
    private assertAdvancesUntouched;
    private reverseVoucher;
    private cancelCheques;
    private softDeleteTenders;
}
