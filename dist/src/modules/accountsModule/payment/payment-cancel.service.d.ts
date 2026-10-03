import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { PaymentService } from './payment.service';
import { CancelPaymentDto } from './dto/post-payment.dto';
import type { PaymentCancelPayload } from './types/payment-api.types';
export declare class PaymentCancelService {
    private readonly prisma;
    private readonly requestContext;
    private readonly paymentService;
    private readonly recompute;
    constructor(prisma: PrismaService, requestContext: RequestContextService, paymentService: PaymentService, recompute: BillBalanceRecomputeService);
    cancel(dto: CancelPaymentDto): Promise<PaymentCancelPayload>;
    private reverseVoucher;
    private cancelCheques;
    private reverseTds;
}
