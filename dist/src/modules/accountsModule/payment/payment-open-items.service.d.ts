import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import type { AdjacentVoucherQueryDto, DuplicateCheckQueryDto, ListPaymentOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { type PaymentSettings } from './payment.settings';
import type { AdjacentVoucherPayload, DuplicateCheckPayload, OpenCredit, PaymentOpenItemsPayload, PaymentPartyContextPayload } from './types/payment-api.types';
export declare class PaymentOpenItemsService {
    private readonly prisma;
    private readonly appSettingValueService;
    constructor(prisma: PrismaService, appSettingValueService: AppSettingValueService);
    listOpenItems(query: ListPaymentOpenItemsQueryDto): Promise<PaymentOpenItemsPayload>;
    private loadSupplierDiscountTerms;
    private loadPayables;
    private loadSupplierRefnos;
    private loadPostDatedHeld;
    loadHeldDebits(companyId: string, partyId: string): Promise<OpenCredit[]>;
    private loadDefaultBank;
    partyContext(query: PartyContextQueryDto): Promise<PaymentPartyContextPayload>;
    private loadPartySummary;
    private loadRecentPayments;
    private loadChequesOut;
    adjacent(query: AdjacentVoucherQueryDto): Promise<AdjacentVoucherPayload>;
    duplicateCheck(query: DuplicateCheckQueryDto): Promise<DuplicateCheckPayload>;
    loadSettings(companyId: string, branchId?: string | null): Promise<PaymentSettings>;
}
