import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { BillAdjType, BillSettlementMode, BillType } from './types/receipt-enum';
import type { OpenCredit, OpenItemsPayload, PartyContextPayload } from './types/receipt-api.types';
import { ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { type ReceiptSettings } from './receipt.settings';
export declare class OpenItemsService {
    private readonly prisma;
    private readonly appSettingValueService;
    constructor(prisma: PrismaService, appSettingValueService: AppSettingValueService);
    listOpenItems(query: ListOpenItemsQueryDto): Promise<OpenItemsPayload>;
    private loadBills;
    private loadPostDatedHeld;
    private loadBillTcs;
    loadCredits(companyId: string, partyId: string, side?: 'CR' | 'DR'): Promise<OpenCredit[]>;
    partyContext(query: PartyContextQueryDto): Promise<PartyContextPayload>;
    private loadRecentReceipts;
    private loadPendingCheques;
    loadSettings(companyId: string, branchId?: string | null): Promise<ReceiptSettings>;
}
declare function creditRouting(billType: BillType): {
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
};
export { creditRouting };
