import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../../common/dto/http-error-response.dto';
import { StockSummaryService } from './stock-summary.service';
import {
  StockSummaryBranchesDto,
  StockSummaryExportDto,
  StockSummaryGodownsDto,
  StockSummaryGroupsDto,
  StockSummaryItemDto,
  StockSummaryOptionsDto,
  StockSummaryQueryDto,
  StockSummaryRowsDto,
} from './dto/stock-summary-query.dto';
import type {
  BranchesPayload,
  ExportPayload,
  GodownsPayload,
  GroupsPayload,
  ItemPayload,
  OptionsPayload,
  RowsPayload,
  SummaryPayload,
} from './types/stock-summary.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'One branch, a period. Scope (godownId, bucket — default SALEABLE —, groupId / brandId with ' +
  'their subtrees) defines what a row adds up. Inward / outward by type, not sign (a reversal ' +
  'keeps its type with a minus); internal moves with both legs in scope net. Value = the stock ' +
  'engine’s valuation at the date (qty × the branch pool’s rate), cost without tax by default; ' +
  'costAdj = value − (openingValue + inwardValue − outwardValue). Quantities 3 dp in the Qty-in ' +
  'unit, money and rates 2 dp. reserved / available / inTransit / tie / the EXPIRY chip only ' +
  'when to ≥ today (IST). Needs view on menu 302 — 403 STOCK_SUMMARY_RIGHT_VIEW.';

const SCOPE_REFUSALS =
  'STOCK_SUMMARY_RANGE_REVERSED, _BRANCH_NOT_IN_COMPANY, _GODOWN_NOT_IN_BRANCH, _GROUP_NOT_FOUND, ' +
  '_BRAND_NOT_FOUND (in that order)';

const RUN_NOTE =
  'Reads the run kept by Show (no SQL beyond the rights row). A run lives 15 min idle (each ' +
  'read renews) and answers only its own user: anything else is 410 STOCK_SUMMARY_RUN_EXPIRED — ' +
  'run Show again.';

/**
 * stock/reports/summary — plan 2026-11-13 §5. Eight GET routes, read-only,
 * with their own DTOs (no other URL's). No HTTP cache anywhere: the answer
 * depends on the caller's rights and on the run store.
 */
@ApiTags('Stock Reports — Stock Summary')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'STOCK_SUMMARY_RIGHT_VIEW' })
@Controller('stock/reports/summary')
export class StockSummaryController {
  constructor(private readonly service: StockSummaryService) {}

  @Get('options')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The page’s choices: godowns of the branch, buckets, today, FY, defaults, rights',
    description:
      'Call when the screen opens and when the Company or Branch changes. defaults.from = the 1st ' +
      'of this month (IST), defaults.to = today.',
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY',
  })
  async options(@Query() q: StockSummaryOptionsDto): Promise<Ok<OptionsPayload>> {
    const data = await this.service.options(q);
    return { success: true, message: 'Summary options', data };
  }

  @Get()
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Show: compute the Item-wise run once, keep it, answer page 1',
    description:
      'head (runId, asOf, todayOnly …), tiles and totals over the whole run (totals.rowsShown ' +
      'follows the view), tie, transitOut, one page of rows. Later pages / sorts / Find / tile ' +
      'filters go to /rows with head.runId. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${SCOPE_REFUSALS}, STOCK_SUMMARY_TOO_MANY_ITEMS`,
  })
  async show(@Query() q: StockSummaryQueryDto): Promise<Ok<SummaryPayload>> {
    const data = await this.service.show(q);
    return { success: true, message: `${data.page.totalRows} item(s)`, data };
  }

  @Get('rows')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Another page / sort / filter / Find of a run (Item-wise or Branch-wise rows)',
    description: `totalsShown = the value totals of every row of the view. ${RUN_NOTE}`,
  })
  @ApiGoneResponse({ type: HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' })
  async rows(@Query() q: StockSummaryRowsDto): Promise<Ok<RowsPayload>> {
    const data = await this.service.rows(q);
    return { success: true, message: `${data.page.totalRows} row(s)`, data };
  }

  @Get('item')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The two panes for one row: item facts, Lots & godowns, Movement',
    description:
      'Stateless (the scope again + itemId). lots.source STOCK_BALANCE when to ≥ today, else ' +
      'LEDGER (the holdings at the pool rate, no reserved / available). movement.byType = the ' +
      'Item Ledger’s By voucher type for the same scope; its opening / closing values are the ' +
      'Summary’s. runId (optional) adds ties.row = the pane equals the grid row. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${SCOPE_REFUSALS}, then STOCK_SUMMARY_ITEM_NOT_FOUND`,
  })
  async item(@Query() q: StockSummaryItemDto): Promise<Ok<ItemPayload>> {
    const data = await this.service.item(q);
    return { success: true, message: 'Item detail', data };
  }

  @Get('groups')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Group summary tab of an Item-wise run (by Group / Brand / Section / Category)',
    description: `A null key is "(No …)"; drill with groupBy + groupKey=NONE on /rows. ${RUN_NOTE}`,
  })
  @ApiGoneResponse({ type: HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' })
  async groups(@Query() q: StockSummaryGroupsDto): Promise<Ok<GroupsPayload>> {
    const data = await this.service.groups(q);
    return { success: true, message: `${data.rows.length} group(s)`, data };
  }

  @Get('godowns')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Godown-wise tab of an Item-wise run: one qty column per godown + value',
    description:
      'Columns = the branch’s godowns with any non-zero cell in the run. The Godown filter is ' +
      `ignored here (this tab is the split); the bucket scope holds. ${RUN_NOTE}`,
  })
  @ApiGoneResponse({ type: HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' })
  async godowns(@Query() q: StockSummaryGodownsDto): Promise<Ok<GodownsPayload>> {
    const data = await this.service.godowns(q);
    return { success: true, message: `${data.page.totalRows} row(s)`, data };
  }

  @Get('branches')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary:
      'The Branch-wise tab: open a Branch-wise run (one column per branch + in transit + chain)',
    description:
      'No godownId (400 if sent). head.source STOCK_BALANCE when to ≥ today (stock_balance + ' +
      'stock_transit), else LEDGER (a company-wide replay, slower). Later pages through /rows. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${SCOPE_REFUSALS}, STOCK_SUMMARY_TOO_MANY_ITEMS`,
  })
  async branches(@Query() q: StockSummaryBranchesDto): Promise<Ok<BranchesPayload>> {
    const data = await this.service.branches(q);
    return { success: true, message: `${data.page.totalRows} item(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Every row of the tab on screen (no paging) for Excel (CSV) and print',
    description:
      'tab ITEMS / GROUPS / GODOWNS read an Item-wise run, BRANCHES a Branch-wise one (another ' +
      'kind = 410). Needs VIEW and EXPORT on 302. More than 20,000 rows = 422 ' +
      `STOCK_SUMMARY_TOO_MANY_ROWS. ${RUN_NOTE}`,
  })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'STOCK_SUMMARY_RIGHT_VIEW, STOCK_SUMMARY_RIGHT_EXPORT',
  })
  @ApiGoneResponse({ type: HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'STOCK_SUMMARY_TOO_MANY_ROWS',
  })
  async export(@Query() q: StockSummaryExportDto): Promise<Ok<ExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} row(s)`, data };
  }
}
