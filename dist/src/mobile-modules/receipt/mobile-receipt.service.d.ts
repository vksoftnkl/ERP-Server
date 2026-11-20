import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { OpenItemsService, type CompanyOpenBill, type CompanyOpenCredit } from '../../modules/accountsModule/receipt/open-items.service';
import { ReceiptService } from '../../modules/accountsModule/receipt/receipt.service';
import { ReceiptPostingService } from '../../modules/accountsModule/receipt/receipt-posting.service';
import type { ReceiptPayload } from '../../modules/accountsModule/receipt/types/receipt-api.types';
import { CreateMobileReceiptDto, MobileOpenBillsQueryDto, MobileReceiptOptionsQueryDto } from './dto/mobile-receipt.dto';
import { type PlanCredit, type PlanLine, type SettledFigure } from './mobile-receipt-plan';
import type { MobileOpenBillsPayload, MobileOpenItemKind, MobileReceiptAllocation, MobileReceiptCreateResult, MobileReceiptCreditApplied, MobileReceiptOptions, MobileReceiptPdcVoucher } from './types/mobile-receipt-api.types';
export declare const MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES: string[];
export interface PhonePlan {
    lines: PlanLine[];
    credits: PlanCredit[];
    fillAll: boolean;
}
export interface MobileSettlement {
    allocations: MobileReceiptAllocation[];
    creditsApplied: MobileReceiptCreditApplied[];
    pdcVouchers: MobileReceiptPdcVoucher[];
    onAccount: string;
    figures: {
        bills: Map<string, SettledFigure>;
        credits: Map<string, Prisma.Decimal>;
    };
}
export declare function receiptDayOf(avhVoucherDate: string | undefined, today: string): string;
export declare function phonePlanOf(dto: CreateMobileReceiptDto): PhonePlan | null;
export declare function settlementOf(payload: Pick<ReceiptPayload, 'allocations' | 'creditsApplied' | 'advanceBills'> & Partial<Pick<ReceiptPayload, 'pdcVouchers'>>): MobileSettlement;
export declare function creditKindOf(billType: string): MobileOpenItemKind;
type OpenRow = {
    kind: 'BILL';
    row: CompanyOpenBill;
    ablPartyId: string;
} | {
    kind: 'CREDIT';
    row: CompanyOpenCredit;
    ablPartyId: string;
};
export declare function mergeByParty(bills: readonly CompanyOpenBill[], credits: readonly CompanyOpenCredit[]): OpenRow[];
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
    private collectorOf;
    private assertDocRefnoFree;
    private refuseDocRefno;
    private toDraftDto;
    private fillOpenBills;
    private settlePhonePlan;
    private tendersOf;
    private findReceipt;
    private resendAnswer;
    private answerFrom;
    private adjustedOf;
}
export {};
