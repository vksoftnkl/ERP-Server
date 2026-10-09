import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DocRegisterService } from "../../../common/posting/doc-register.service";
import { VoucherPostingService } from "../../../common/posting/voucher-posting.service";
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { TillApprovalService } from '../../till/services/till-approval.service';
import { TillSessionService } from '../../till/services/till-session.service';
import { TenderDetailService } from '../tenderDetail/tender-detail.service';
import type { SaveExpenseDto } from './dto/save-expense.dto';
import type { ExpenseLedgerPickPayload, ExpensePayload, ExpensePostPayload, ExpenseQuickReasonPayload, ExpenseValidatePayload } from './types/expense-api.types';
interface ExpenseKey {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherId: string;
}
export declare class ExpenseService {
    private readonly prisma;
    private readonly requestContext;
    private readonly tenderDetail;
    private readonly posting;
    private readonly register;
    private readonly till;
    private readonly approvals;
    private readonly appSettings;
    constructor(prisma: PrismaService, requestContext: RequestContextService, tenderDetail: TenderDetailService, posting: VoucherPostingService, register: DocRegisterService, till: TillSessionService, approvals: TillApprovalService, appSettings: AppSettingValueService);
    save(dto: SaveExpenseDto): Promise<ExpensePayload>;
    validate(dto: SaveExpenseDto): Promise<ExpenseValidatePayload>;
    post(key: ExpenseKey): Promise<ExpensePostPayload>;
    cancel(key: ExpenseKey & {
        reason: string;
    }): Promise<ExpensePayload>;
    get(key: ExpenseKey): Promise<ExpensePayload>;
    quickReasons(companyId: string): Promise<ExpenseQuickReasonPayload[]>;
    ledgerPick(companyId: string, search: string | null): Promise<ExpenseLedgerPickPayload[]>;
    private derive;
    private moneyChecks;
    private warnNoGstBill;
    private expenseLedgerIds;
    private storedTenders;
    private storedLegs;
    private registerDoc;
    private markMoneyFrom;
    private refusalFromTill;
    private assertUniqueRows;
    private draftOf;
    private voucherType;
    private load;
    private lockHeader;
    private actor;
    private actorName;
}
export {};
