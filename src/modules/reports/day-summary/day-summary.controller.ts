import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { DaySummaryService } from './day-summary.service';
import {
  DaySummaryCheckDetailDto,
  DaySummaryExportDto,
  DaySummaryGroupLedgersDto,
  DaySummaryScopeDto,
  DaySummaryVouchersDto,
} from './dto/day-summary-query.dto';
import type {
  CheckDetailPayload,
  DailyPayload,
  ExportPayload,
  GroupLedgersPayload,
  SummaryPayload,
  VouchersPayload,
  VoucherTypesPayload,
} from './types/day-summary.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'Counts the legs of POSTED **and** CANCELLED vouchers; DRAFT only as a count. A cancelled ' +
  'pair with both halves inside the range is left out of every figure (it nets to zero) and ' +
  'reported as cancelledPairs; a lone half is counted on its own type row (loneHalves). ' +
  'Amount = Σ DR legs, never avh_doc_amount. branchId absent = All branches; toDate absent = ' +
  'fromDate. Amounts are strings with two decimals; sides are DR / CR. Needs view on menu ' +
  '284 (Account Day Summary) or 181 (Day Book Detail) — 403 NO_MENU_RIGHT otherwise.';

const REFUSALS =
  'BRANCH_NOT_IN_COMPANY, YEAR_UNKNOWN, RANGE_OUTSIDE_YEAR, RANGE_REVERSED, TYPE_UNKNOWN';

/**
 * reports/day-summary — plan 2026-10-12 §5. Seven GET routes, all read-only,
 * sharing no URL, DTO or payload with another module (§2). No cache anywhere:
 * the day book is read to check what was posted a moment ago.
 */
@ApiTags('Reports — Account Day Summary')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'NO_MENU_RIGHT' })
@Controller('reports/day-summary')
export class DaySummaryController {
  constructor(private readonly service: DaySummaryService) {}

  @Get('voucher-types')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Type combo',
    description:
      'Active voucher types that post legs, in vchr_sort_order. The INVENTORY types that post ' +
      '(OPENING, Phy, StkAdj) are in; Quo and SOr (vchr_affects_accounts = false) are not.',
  })
  async voucherTypes(): Promise<Ok<VoucherTypesPayload>> {
    const data = await this.service.voucherTypes();
    return { success: true, message: `${data.items.length} voucher type(s)`, data };
  }

  @Get('summary')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Summary tab — tiles, type grid, money grid, group grid and checks, one snapshot',
    description:
      'One read-only REPEATABLE READ transaction, so every panel ties to the others. ' +
      'businessDay is filled for a one-day request only. With voucherTypeId, money opening / ' +
      'closing are null. checks carry codes and facts, never sentences. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async summary(@Query() q: DaySummaryScopeDto): Promise<Ok<SummaryPayload>> {
    const data = await this.service.summary(q);
    return { success: true, message: 'Account day summary', data };
  }

  @Get('vouchers')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Vouchers tab (day book detail) — one row per voucher, paged',
    description:
      'Ordered by date, avh_voucher_slno, voucher id. rowKind NORMAL / CANCELLED / REVERSAL; ' +
      'pairInRange marks the halves /summary left out (shown unless includeCancelledPairs=' +
      'false). natureFilter / moneyKind narrow a drill. withLegs inlines every leg. ' +
      'draftsOnly=true returns the DRAFT headers instead (amount = avh_doc_amount). ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async vouchers(@Query() q: DaySummaryVouchersDto): Promise<Ok<VouchersPayload>> {
    const data = await this.service.vouchers(q);
    return { success: true, message: `${data.page.totalRows} voucher(s)`, data };
  }

  @Get('daily')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Day-wise tab — one row per calendar day',
    description:
      'Each day is its own day book: a cancelled pair is left out when both halves fall on ' +
      'that day, so each closing is the true balance at that day’s end and the last one equals ' +
      'the /summary closing. Days with nothing only with zeroRows. Not paged (≤ 366 rows). ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async daily(@Query() q: DaySummaryScopeDto): Promise<Ok<DailyPayload>> {
    const data = await this.service.daily(q);
    return { success: true, message: `${data.days.length} day(s)`, data };
  }

  @Get('group-ledgers')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Enter on a group row — the ledgers rolled into it',
    description:
      'The ledgers whose group rolls into groupId at groupLevel, same legs and pair rule as ' +
      '/summary. Enter on a ledger opens the Ledger Statement on the client. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: `${REFUSALS}, GROUP_UNKNOWN` })
  async groupLedgers(@Query() q: DaySummaryGroupLedgersDto): Promise<Ok<GroupLedgersPayload>> {
    const data = await this.service.groupLedgers(q);
    return { success: true, message: `${data.ledgers.length} ledger(s)`, data };
  }

  @Get('checks/detail')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: '"Show me" on a check — the rows behind it',
    description:
      'code = BALANCED, AMOUNT_TIES, LEGLESS, DRAFTS, CANCELLED_PAIRS, CLEARING_PENDING, ' +
      'BUSINESS_DAY, FUTURE_DATED or NUMBER_GAPS. At most 500 rows (truncated: true beyond).',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: `${REFUSALS}, CHECK_UNKNOWN` })
  async checkDetail(@Query() q: DaySummaryCheckDetailDto): Promise<Ok<CheckDetailPayload>> {
    const data = await this.service.checkDetail(q);
    return { success: true, message: `${data.rows.length} row(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: '/summary plus every /vouchers row, for the client to print / PDF / Excel / WhatsApp',
    description:
      'One snapshot. withLegs defaults to true here. Over 20,000 vouchers → 422 ' +
      'RANGE_TOO_LARGE with the count. Data only: nothing is rendered or sent. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: 'RANGE_TOO_LARGE' })
  async export(@Query() q: DaySummaryExportDto): Promise<Ok<ExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} voucher(s)`, data };
  }
}
