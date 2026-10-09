import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CancelExpenseDto, ExpenseKeyDto, ExpenseLedgerPickQueryDto, ExpenseReasonQueryDto, SaveExpenseDto } from './dto/save-expense.dto';
import { ExpenseService } from './expense.service';
import type { ExpenseLedgerPickPayload, ExpensePayload, ExpensePostPayload, ExpenseQuickReasonPayload, ExpenseSuccessResponse, ExpenseValidatePayload } from './types/expense-api.types';
export declare class ExpenseController {
    private readonly expenses;
    private readonly prisma;
    private readonly requestContext;
    constructor(expenses: ExpenseService, prisma: PrismaService, requestContext: RequestContextService);
    create(dto: SaveExpenseDto): Promise<ExpenseSuccessResponse<ExpensePayload>>;
    validate(dto: SaveExpenseDto): Promise<ExpenseSuccessResponse<ExpenseValidatePayload>>;
    post(dto: ExpenseKeyDto): Promise<ExpenseSuccessResponse<ExpensePostPayload>>;
    get(query: ExpenseKeyDto): Promise<ExpenseSuccessResponse<ExpensePayload>>;
    cancel(dto: CancelExpenseDto): Promise<ExpenseSuccessResponse<ExpensePayload>>;
    quickReasons(query: ExpenseReasonQueryDto): Promise<ExpenseSuccessResponse<ExpenseQuickReasonPayload[]>>;
    ledgerPick(query: ExpenseLedgerPickQueryDto): Promise<ExpenseSuccessResponse<ExpenseLedgerPickPayload[]>>;
    private requireRight;
}
