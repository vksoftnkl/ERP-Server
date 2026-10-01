import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import type { CancelPayload } from './types/vouchers-api.types';
import type { CancelVoucherDto } from './dto/voucher-payload.dto';
import { VoucherRegisterService } from './voucher-register.service';
import { VoucherTypesService } from './voucher-types.service';
export declare class VoucherCancelService {
    private readonly prisma;
    private readonly requestContext;
    private readonly register;
    private readonly types;
    private readonly posting;
    private readonly docRegister;
    private readonly recompute;
    constructor(prisma: PrismaService, requestContext: RequestContextService, register: VoucherRegisterService, types: VoucherTypesService, posting: VoucherPostingService, docRegister: DocRegisterService, recompute: BillBalanceRecomputeService);
    cancel(dto: CancelVoucherDto): Promise<CancelPayload>;
}
