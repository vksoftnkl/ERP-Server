import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { BillAdjType, BillSettlementMode, BillType } from './types/receipt-enum';
import type { AdjacentVoucherPayload, DuplicateCheckPayload, OpenCredit, OpenItemsPayload, PartyContextPayload } from './types/receipt-api.types';
import { AdjacentVoucherQueryDto, DuplicateCheckQueryDto, ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { type ReceiptSettings } from './receipt.settings';
export declare class OpenItemsService {
    private readonly prisma;
    private readonly appSettingValueService;
    constructor(prisma: PrismaService, appSettingValueService: AppSettingValueService);
    listOpenItems(query: ListOpenItemsQueryDto): Promise<OpenItemsPayload>;
    private loadBills;
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
