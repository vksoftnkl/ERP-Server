import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SalesContextService } from '../posting/sales-context.service';
import type { BillVoucherTypeChoicesQueryDto } from './dto/bill-voucher-type-choices.dto';
export interface BillVoucherTypeChoice {
    vchrTypeId: number;
    vchrTypeCode: string;
    vchrTypeName: string;
    vchrTypeShort: string | null;
    vchrNoPrefix: string | null;
    isBase: boolean;
    nextRefno: string | null;
    nextRefnoCode: string | null;
    deliveryMode: 'INSTANT' | 'PICKUP' | 'DISPATCH';
}
export interface BillVoucherTypeChoices {
    choices: BillVoucherTypeChoice[];
    defaultVchrTypeId: number | null;
    offerBase: boolean;
    hasChildTypes: boolean;
}
export declare class BillVoucherTypeService {
    private readonly prisma;
    private readonly salesContext;
    private readonly requestContext;
    private readonly config;
    constructor(prisma: PrismaService, salesContext: SalesContextService, requestContext: RequestContextService, config: ConfigService);
    choices(q: BillVoucherTypeChoicesQueryDto): Promise<BillVoucherTypeChoices>;
    private baseDeliveryMode;
}
