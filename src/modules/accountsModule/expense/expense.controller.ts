import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { assertMenuRight, type MenuRight } from '../../../common/posting/rights';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  CancelExpenseDto,
  ExpenseKeyDto,
  ExpenseLedgerPickQueryDto,
  ExpenseReasonQueryDto,
  SaveExpenseDto,
} from './dto/save-expense.dto';
import { ExpenseExceptionFilter } from './expense-exception.filter';
import { ExpenseService } from './expense.service';
import type {
  ExpenseLedgerPickPayload,
  ExpensePayload,
  ExpensePostPayload,
  ExpenseQuickReasonPayload,
  ExpenseSuccessResponse,
  ExpenseValidatePayload,
} from './types/expense-api.types';
import { EXPENSE_MENU_ID, EXPENSE_RIGHT_PREFIX } from './types/expense-enum';

/**
 * /expenses/* — the expense voucher (ExpV): an expense paid by one or more
 * tenders (plan-till-receipt-payment-expense §4). Every verb is judged on
 * menu 277 (no SUPER ADMIN bypass). Keys: companyId · branchId · accYear · voucherId.
 */
@ApiTags('Expense Voucher')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'EXP_RIGHT_<VERB> on menu 277' })
@UseFilters(ExpenseExceptionFilter)
@Controller('expenses')
export class ExpenseController {
  constructor(
    private readonly expenses: ExpenseService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Save a DRAFT expense voucher (create, or edit with voucherId)',
    description:
      'Lines (expense ledgers; with a GST bill each line is a taxable value and a rate) and tenders. Nothing is ' +
      'numbered or posted. The answer carries what /post would write (derived). Menu 277 CREATE / EDIT.',
  })
  @ApiCreatedResponse({ description: 'The draft, with its derived legs' })
  @ApiConflictResponse({ type: HttpErrorResponseDto, description: 'The voucher is not a DRAFT' })
  async create(@Body() dto: SaveExpenseDto): Promise<ExpenseSuccessResponse<ExpensePayload>> {
    await this.requireRight(dto.voucherId ? 'edit' : 'create', 'save an expense voucher');
    const data = await this.expenses.save(dto);
    return { success: true, message: `Expense voucher saved as ${data.status}`, data };
  }

  @Post('validate')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'What /post would write and refuse — always 200',
    description:
      'Derived legs (lines, input GST, tenders and where each one’s money comes from: DRAWER, SAFE, LEDGER), ' +
      'refusals (EXPENSE_TOTAL_MISMATCH, EXPENSE_LEDGER_NOT_EXPENSE, EXPENSE_GST_INCOMPLETE, TILL_SESSION_REQUIRED …), ' +
      'warnings (EXPENSE_GST_BILL_MISSING; STATUTORY_40A3 — cash to one payee in a day above the 40A(3) ' +
      'limit, a refusal under a company REFUSE row; TILL_APPROVAL_REQUIRED, INFO) and `approval`: what the ' +
      'EXPENSE rule would ask in a till session, reported until phase 3 builds the gate. Saves nothing. ' +
      'Menu 277 VIEW.',
  })
  @ApiOkResponse({ description: '{ ok, derived, refusals, warnings, approval }' })
  async validate(
    @Body() dto: SaveExpenseDto,
  ): Promise<ExpenseSuccessResponse<ExpenseValidatePayload>> {
    await this.requireRight('view', 'validate an expense voucher');
    const data = await this.expenses.validate(dto);
    return {
      success: true,
      message: data.ok ? 'The expense voucher can be posted' : `${data.refusals.length} refusal(s)`,
      data,
    };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Post a DRAFT: number it, write its legs, its tender rows and (with a GST bill) the GSTR-2 row',
    description:
      'On a device in a till session the CASH rows are that drawer (the voucher carries the session); on a ' +
      'back-office device in a branch that runs a till they come from the default safe (till.backoffice_cash_from ' +
      '= SAFE) or are refused (REFUSE). The answer carries the warnings /validate gave (40A(3), the EXPENSE ' +
      'approval need — neither blocks). Menu 277 POST.',
  })
  @ApiCreatedResponse({ description: 'The posted voucher' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'Every refusal, with its code',
  })
  @ApiConflictResponse({
    type: HttpErrorResponseDto,
    description:
      'Not a DRAFT · TILL_SESSION_REQUIRED · TILL_SESSION_WRONG_DEVICE · TILL_SESSION_NOT_YOURS',
  })
  async post(@Body() dto: ExpenseKeyDto): Promise<ExpenseSuccessResponse<ExpensePostPayload>> {
    await this.requireRight('post', 'post an expense voucher');
    const data = await this.expenses.post(dto);
    return { success: true, message: `Expense voucher ${data.voucherNo} posted`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({ summary: 'One expense voucher: header, lines, tenders, legs. Menu 277 VIEW.' })
  @ApiOkResponse({ description: 'The voucher' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async get(@Query() query: ExpenseKeyDto): Promise<ExpenseSuccessResponse<ExpensePayload>> {
    await this.requireRight('view', 'view an expense voucher');
    const data = await this.expenses.get(query);
    return { success: true, message: `Expense voucher is ${data.status}`, data };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel a POSTED expense voucher: a mirror in the Rev series',
    description:
      'Refused once the till session it moved money in has stopped taking money (TILL_SESSION_CLOSED): ' +
      'correct it with a new document or a journal. Menu 277 CANCEL.',
  })
  @ApiOkResponse({ description: 'The cancelled voucher' })
  @ApiConflictResponse({
    type: HttpErrorResponseDto,
    description: 'Not POSTED · TILL_SESSION_CLOSED',
  })
  async cancel(@Body() dto: CancelExpenseDto): Promise<ExpenseSuccessResponse<ExpensePayload>> {
    await this.requireRight('cancel', 'cancel an expense voucher');
    const data = await this.expenses.cancel(dto);
    return { success: true, message: `Expense voucher ${data.voucherNo} cancelled`, data };
  }

  @Get('quick-reasons')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary:
      'The EXPENSE till reasons (tea, courier, repair …) and the ledger each fills a line with',
  })
  @ApiOkResponse({ description: 'Reasons, sort order then name' })
  async quickReasons(
    @Query() query: ExpenseReasonQueryDto,
  ): Promise<ExpenseSuccessResponse<ExpenseQuickReasonPayload[]>> {
    await this.requireRight('view', 'list expense reasons');
    const data = await this.expenses.quickReasons(query.companyId);
    return { success: true, message: `${data.length} reason(s)`, data };
  }

  @Get('ledger-pick')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary:
      'The ledgers a line may debit: live, under an Expenses group, the company’s and shared',
  })
  @ApiOkResponse({ description: 'Ledgers by name (500 at most)' })
  async ledgerPick(
    @Query() query: ExpenseLedgerPickQueryDto,
  ): Promise<ExpenseSuccessResponse<ExpenseLedgerPickPayload[]>> {
    await this.requireRight('view', 'list expense ledgers');
    const data = await this.expenses.ledgerPick(query.companyId, query.search ?? null);
    return { success: true, message: `${data.length} ledger(s)`, data };
  }

  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: EXPENSE_MENU_ID,
      right,
      codePrefix: EXPENSE_RIGHT_PREFIX,
      action,
    });
  }
}
