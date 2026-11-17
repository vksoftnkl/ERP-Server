import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { OpenItemsService } from '../../modules/accountsModule/receipt/open-items.service';
import { ReceiptService } from '../../modules/accountsModule/receipt/receipt.service';
import { ReceiptPostingService } from '../../modules/accountsModule/receipt/receipt-posting.service';
import type { ReceiptPayload } from '../../modules/accountsModule/receipt/types/receipt-api.types';
import { CreateMobileReceiptDto, MobileOpenBillsQueryDto, MobileReceiptOptionsQueryDto } from './dto/mobile-receipt.dto';
import type { MobileOpenBillsPayload, MobileReceiptAllocation, MobileReceiptCreateResult, MobileReceiptOptions } from './types/mobile-receipt-api.types';
export declare const MOBILE_RECEIPT_TENDER_TYPES: string[];
export declare function receiptDayOf(avhVoucherDate: string | undefined, today: string): string;
export declare function settlementOf(payload: Pick<ReceiptPayload, 'allocations' | 'advanceBills'>): {
    allocations: MobileReceiptAllocation[];
    onAccount: string;
};
export declare class MobileReceiptService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly receipts;
    private readonly posting;
    private readonly openItems;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, receipts: ReceiptService, posting: ReceiptPostingService, openItems: OpenItemsService);
    options(query: MobileReceiptOptionsQueryDto): Promise<MobileReceiptOptions>;
    openBills(query: MobileOpenBillsQueryDto): Promise<MobileOpenBillsPayload>;
    private customersOnly;
    create(dto: CreateMobileReceiptDto): Promise<MobileReceiptCreateResult>;
    private toDraftDto;
    private fillOpenBills;
    private tendersOf;
    private findReceipt;
    private resendAnswer;
    private toAnswer;
}
