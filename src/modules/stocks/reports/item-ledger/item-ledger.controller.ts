import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../../common/dto/http-error-response.dto';
import { ItemLedgerService } from './item-ledger.service';
import {
  ItemLedgerExportDto,
  ItemLedgerMonthsDto,
  ItemLedgerOptionsDto,
  ItemLedgerQueryDto,
  ItemLedgerScopeDto,
} from './dto/item-ledger-query.dto';
import type {
  DaysPayload,
  ExportPayload,
  LedgerPayload,
  MonthsPayload,
  OptionsPayload,
} from './types/item-ledger.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'One item at one branch. Scope (godownId, bucket — default SALEABLE —, lotId) defines the ' +
  'holding: opening, balance and closing follow it. Row filters (types, showReversed) only hide ' +
  'rows: balances never move, and totals are "of the rows shown". Opening = Σ every ledger row ' +
  'of the holding before `from`, all years. A cancelled / amended pair nets to 0 and is shown ' +
  'greyed (state CANCELLED / AMENDED + REVERSAL). Quantities are strings with 3 dp in the Qty-in ' +
  'unit (unitId, default base), money and rates 2 dp, cost without tax by default (valueAt). ' +
  'Needs view on menu 301 (Reports › Stock Reports › Item Ledger) — 403 ITEM_LEDGER_RIGHT_VIEW.';

const REFUSALS =
  'ITEM_LEDGER_RANGE_REVERSED, _BRANCH_NOT_IN_COMPANY, _ITEM_NOT_FOUND, _GODOWN_NOT_IN_BRANCH, ' +
  '_LOT_NOT_OF_ITEM, _UNIT_NOT_OF_ITEM (in that order)';

/**
 * stock/reports/item-ledger — plan 2026-11-11 §5. Five GET routes, read-only,
 * with their own DTOs (no other URL's).
 *
 * No cache anywhere: the report is read to check a bill posted a moment ago,
 * and its answer depends on the caller's rights.
 */
@ApiTags('Stock Reports — Item Ledger')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'ITEM_LEDGER_RIGHT_VIEW' })
@Controller('stock/reports/item-ledger')
export class ItemLedgerController {
  constructor(private readonly service: ItemLedgerService) {}

  @Get('options')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The item facts and the More-filters choices (call on an item pick)',
    description:
      'godowns = the branch’s live godowns; lots = the item’s lots with any ledger row at this ' +
      'branch (≤ 500, newest expiry first, onHand in base units); types = the report types this ' +
      'item has here, all time; lastCountDate = the latest POSTED physical count with a live line ' +
      'for the item; fy = the financial year of today; rights = print / export on menu 301.',
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'ITEM_LEDGER_BRANCH_NOT_IN_COMPANY, ITEM_LEDGER_ITEM_NOT_FOUND',
  })
  async options(@Query() q: ItemLedgerOptionsDto): Promise<Ok<OptionsPayload>> {
    const data = await this.service.options(q);
    return { success: true, message: 'Item options', data };
  }

  @Get()
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary:
      'The Vouchers tab: head, opening, closing, totals, tiles, tie, one page of rows, panes',
    description:
      'rows in posting order (date, time, posted time, original before its reversal); seq and ' +
      'balanceQty are always the ascending ones, order=desc only flips the listing. page / limit ' +
      '(≤ 5,000, default 1,000) page the rows shown. tie is checked only when to ≥ today (IST). ' +
      'periodTie { qtyEqual, valueEqual } = opening + totals in − out = closing, decided on the ' +
      'exact base numbers before the unit and the rounding (show it, do not re-add the strings); ' +
      'both null when a row filter hides any row. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async ledger(@Query() q: ItemLedgerQueryDto): Promise<Ok<LedgerPayload>> {
    const data = await this.service.ledger(q);
    return { success: true, message: `${data.page.totalRows} row(s)`, data };
  }

  @Get('days')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Day-wise tab: one row per day with movement, opening → closing chain',
    description: `periodTie as on the main route. ${SCOPE_NOTE}`,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async days(@Query() q: ItemLedgerScopeDto): Promise<Ok<DaysPayload>> {
    const data = await this.service.days(q);
    return { success: true, message: `${data.days.length} day(s)`, data };
  }

  @Get('months')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Month-wise tab: every month of the financial year of `to`, up to `to`',
    description:
      'No `from`: the months run from the financial year’s first day (public.fiscal_years); the ' +
      'last is partial when to is before its month end. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${REFUSALS}, then ITEM_LEDGER_NO_FISCAL_YEAR`,
  })
  async months(@Query() q: ItemLedgerMonthsDto): Promise<Ok<MonthsPayload>> {
    const data = await this.service.months(q);
    return { success: true, message: `${data.months.length} month(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Every row of the period (no paging) for Excel (CSV) and the A4 print',
    description:
      'The main answer’s head, opening, closing, totals and all rows, + printedAs (the filters ' +
      'as one sentence). More than 20,000 rows after the filters = 422 ITEM_LEDGER_TOO_MANY_ROWS. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${REFUSALS}, ITEM_LEDGER_TOO_MANY_ROWS`,
  })
  async export(@Query() q: ItemLedgerExportDto): Promise<Ok<ExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} row(s)`, data };
  }
}
