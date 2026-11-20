import { PrismaService } from '../../database/prisma/prisma.service';
import { MobileReceiptStatusQueryDto } from './dto/mobile-receipt.dto';
import type { MobileReceiptStatusPayload } from './types/mobile-receipt-api.types';
export declare const MOBILE_RECEIPT_STATUS_OVERLAP_MINUTES = 5;
export declare function phoneChequeStatus(houseStatus: string): string;
export declare class MobileReceiptStatusService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    status(query: MobileReceiptStatusQueryDto): Promise<MobileReceiptStatusPayload>;
    private rowsOf;
}
