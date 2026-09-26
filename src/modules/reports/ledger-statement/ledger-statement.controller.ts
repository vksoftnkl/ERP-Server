import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { LedgerStatementService } from './ledger-statement.service';
import {
  LedgerStatementExportDto,
  LedgerStatementLedgersDto,
  LedgerStatementRangeDto,
  LedgerStatementScopeDto,
  LedgerStatementVoucherLegsDto,
  LedgerStatementVouchersDto,
} from './dto/ledger-statement-query.dto';
import type {
  DailyPayload,
  ExportPayload,
  LedgerHeaderPayload,
  LedgerPickPayload,
  MonthlyPayload,
  VoucherLegsPayload,
  VouchersPayload,
} from './types/ledger-statement.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'Counts POSTED **and** CANCELLED vouchers (a cancel keeps the original’s legs and posts a ' +
  'POSTED mirror — the pair nets to zero); DRAFT never. branchId absent = All branches (every ' +
  'opening set + every branch’s legs). Amounts are strings with two decimals; sides are DR / CR. ' +
  'Needs view on menu 258 (Ledger Statement) or 144 (Ledger Monthly Summary) — 403 otherwise.';

/**
 * reports/ledger-statement — plan 2026-09-25 §5. Seven GET routes, all
 * read-only, and no other URL's DTO or payload (§2): when the voucher / ledger
 * routes change shape later, this module does not move.
 *
 * No cache anywhere: a statement is read to check a posting made a moment ago.
 */
@ApiTags('Reports — Ledger Statement')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'NO_MENU_RIGHT' })
@Controller('reports/ledger-statement')
export class LedgerStatementController {
  constructor(private readonly service: LedgerStatementService) {}

  @Get('ledgers')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The ledger picker (search-as-you-type, PgUp / PgDn within a group)',
    description:
      'Ledgers of the company plus the shared ones (led_company_id IS NULL), sorted by name. ' +
      '`search` matches name, alias, short name, GSTIN or phone.',
  })
  async ledgers(@Query() q: LedgerStatementLedgersDto): Promise<Ok<LedgerPickPayload>> {
    const data = await this.service.ledgers(q);
    return { success: true, message: `${data.items.length} ledger(s)`, data };
  }

  @Get('header')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'LEDGER DETAIL + PERIOD SUMMARY — the three top panels',
    description:
      'Opening at fromDate, gross debit / credit in the period with voucher counts, closing at ' +
      'toDate, cancelled pairs inside the period, and openingNote = COMPANY_LEVEL_ONLY when a ' +
      'branch is picked but the ledger was opened at company level only. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description:
      'LEDGER_NOT_IN_COMPANY, BRANCH_NOT_IN_COMPANY, YEAR_UNKNOWN, RANGE_OUTSIDE_YEAR, RANGE_REVERSED',
  })
  async header(@Query() q: LedgerStatementRangeDto): Promise<Ok<LedgerHeaderPayload>> {
    const data = await this.service.header(q);
    return { success: true, message: 'Ledger statement header', data };
  }

  @Get('vouchers')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The voucher grid — one row per voucher, running balance, paged',
    description:
      'Ordered by date, avh_voucher_slno, voucher id. debit / credit are this ledger’s gross ' +
      'DR / CR legs in the voucher (L3); the balance moves by the net. broughtForward / ' +
      'carriedForward are exact for the page. rowKind NORMAL / CANCELLED / REVERSAL; ' +
      'includeCancelled=false hides a pair only when both halves are in the range. ' +
      'withLegs=true inlines every leg (L4). Opening / total / closing are not rows. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async vouchers(@Query() q: LedgerStatementVouchersDto): Promise<Ok<VouchersPayload>> {
    const data = await this.service.vouchers(q);
    return { success: true, message: `${data.page.totalRows} voucher(s)`, data };
  }

  @Get('voucher-legs')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Every leg of one voucher (Alt+F1 / the ▾ toggle)',
    description: 'av_row_no order; isThisLedger marks the statement ledger’s legs; role = av_role.',
  })
  async voucherLegs(@Query() q: LedgerStatementVoucherLegsDto): Promise<Ok<VoucherLegsPayload>> {
    const data = await this.service.voucherLegs(q);
    return { success: true, message: `${data.legs.length} leg(s)`, data };
  }

  @Get('daily')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Daily tab — one row per date with movement',
    description: 'Not paged: a fiscal year is at most 366 rows. ' + SCOPE_NOTE,
  })
  async daily(@Query() q: LedgerStatementRangeDto): Promise<Ok<DailyPayload>> {
    const data = await this.service.daily(q);
    return { success: true, message: `${data.days.length} day(s)`, data };
  }

  @Get('monthly')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The MONTH-WISE panel / Monthly tab — every month of the fiscal year',
    description:
      'Always the whole year from fy_begin_date, months with no movement included (closing ' +
      'carried) and future months flagged isFuture. Also what menu 144 opens (L1). ' +
      SCOPE_NOTE,
  })
  async monthly(@Query() q: LedgerStatementScopeDto): Promise<Ok<MonthlyPayload>> {
    const data = await this.service.monthly(q);
    return { success: true, message: `${data.months.length} month(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Header + every row, for the client to print / PDF / Excel / WhatsApp',
    description:
      'The /vouchers rows unpaged, with the /header panels. Capped at 20,000 rows — beyond ' +
      'that 422 RANGE_TOO_LARGE with the count. Data only: nothing is rendered or sent. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: 'RANGE_TOO_LARGE' })
  async export(@Query() q: LedgerStatementExportDto): Promise<Ok<ExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} voucher(s)`, data };
  }
}
