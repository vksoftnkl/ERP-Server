import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { BillAdjType, BillSettlementMode, BillType, ReceiptBillSort } from './types/receipt-enum';
import type { AdjacentVoucherPayload, DuplicateCheckPayload, OpenCredit, OpenItemsPayload, PartyContextPayload } from './types/receipt-api.types';
import { AdjacentVoucherQueryDto, DuplicateCheckQueryDto, ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { type ReceiptSettings } from './receipt.settings';
export declare function openReceivableWhere(companyId: string, partyId?: string): Prisma.AccBillBalanceWhereInput;
export interface OpenBillOrderKey {
    ablDueDate: Date | null;
    ablDocDate: Date;
    ablDocRefno: string;
}
export declare function openBillOrder(billSort: ReceiptBillSort): (left: OpenBillOrderKey, right: OpenBillOrderKey) => number;
export interface CompanyOpenBill extends OpenBillOrderKey {
    ablId: string;
    ablAccYear: string;
    ablPartyId: string;
    ablBillType: string;
    ablBillAmount: Prisma.Decimal;
    ablPendingAmount: Prisma.Decimal | null;
}
export declare class OpenItemsService {
    private readonly prisma;
    private readonly appSettingValueService;
    constructor(prisma: PrismaService, appSettingValueService: AppSettingValueService);
    listOpenItems(query: ListOpenItemsQueryDto): Promise<OpenItemsPayload>;
    private attachTempCredits;
    private loadBills;
    listCompanyOpenBills(companyId: string): Promise<CompanyOpenBill[]>;
    private loadPostDatedHeld;
    private loadSourceBillFacts;
    private loadBillTcs;
    loadCredits(companyId: string, partyId: string, side?: 'CR' | 'DR'): Promise<OpenCredit[]>;
    partyContext(query: PartyContextQueryDto): Promise<PartyContextPayload>;
    private loadPartySummary;
    private loadRecentReceipts;
    private loadPendingCheques;
    adjacent(query: AdjacentVoucherQueryDto): Promise<AdjacentVoucherPayload>;
    duplicateCheck(query: DuplicateCheckQueryDto): Promise<DuplicateCheckPayload>;
    loadSettings(companyId: string, branchId?: string | null): Promise<ReceiptSettings>;
}
declare function creditRouting(billType: BillType): {
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
};
export { creditRouting };
