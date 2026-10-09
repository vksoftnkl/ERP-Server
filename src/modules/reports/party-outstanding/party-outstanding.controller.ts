import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { PartyOutstandingService } from './party-outstanding.service';
import {
  OutstandingBillHistoryDto,
  OutstandingBillWiseDto,
  OutstandingDueCalendarDto,
  OutstandingExportDto,
  OutstandingOptionsDto,
  OutstandingPartiesDto,
  OutstandingPartyDto,
  OutstandingSummaryDto,
} from './dto/party-outstanding-query.dto';
import type {
  BillHistoryPayload,
  BillsPayload,
  BillWisePayload,
  DueCalendarPayload,
  ExportPayload,
  OptionsPayload,
  PartiesPayload,
  PartyCardPayload,
  SummaryPayload,
} from './types/party-outstanding.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'Pending as on D, as the books stand today: bill − Σ adjustment rows dated ≤ D − the counter ' +
  'tender that has no row (§3.1, tenderDerived). A reversal carries the original date, so a ' +
  'later cancel changes an earlier D. A post-dated cheque settles on its cheque date. ' +
  'Receivable: DR bills are owed, CR bills on-account; Payable the other way round. asOn decides ' +
  'the year; a carried-forward bill is read once (its OPENING copy). branchId absent = all ' +
  'branches. Amounts are strings with two decimals; a balance is {amount, side} with side null ' +
  'on 0.00. Needs view on menu 279 (Reports › Party Outstanding) — 403 otherwise.';

const REFUSALS =
  'AS_ON_OUTSIDE_YEARS, BAD_BUCKETS, BAD_SORT, NOT_FOR_PAYABLE (area / salesman / collection ' +
  'day on Payable), BRANCH_NOT_IN_COMPANY, PARTY_NOT_IN_COMPANY, RANGE_REVERSED';

/**
 * reports/party-outstanding — plan 2026-10-09 §5. Nine GET routes, all
 * read-only, and no other URL's DTO or payload (§2): when the receipt / credit
 * routes change shape later, this module does not move.
 *
 * No cache anywhere: the report is read to check a receipt posted a moment ago.
 */
@ApiTags('Reports — Party-wise Outstanding')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'NO_MENU_RIGHT' })
@Controller('reports/party-outstanding')
export class PartyOutstandingController {
  constructor(private readonly service: PartyOutstandingService) {}

  @Get('options')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Filter sources: party groups, areas, salesmen, branches',
    description:
      'groups = the side’s default group (Sundry Debtors / Sundry Creditors, isDefault) and its ' +
      'sub-groups in tree order with depth. areas carry their collection days (MON … SUN). areas ' +
      'and salesmen are empty on PAYABLE.',
  })
  async options(@Query() q: OutstandingOptionsDto): Promise<Ok<OptionsPayload>> {
    const data = await this.service.options(q);
    return { success: true, message: `${data.groups.length} group(s)`, data };
  }

  @Get('parties')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The party grid — one row per party, paged — with its totals and the six tiles',
    description:
      'Totals and tiles cover EVERY row that passes the filters, not the page. sort = net | name ' +
      '| overdue | oldest | owed | bucket0 … bucket7 (default net desc); ties break on name, then ' +
      'party id. net = owed − on-account (− PDC in hand with deductPdc). ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async parties(@Query() q: OutstandingPartiesDto): Promise<Ok<PartiesPayload>> {
    const data = await this.service.parties(q);
    return { success: true, message: `${data.page.totalRows} part(ies)`, data };
  }

  @Get('party')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The party card: facts, ageing, on-account items, PDC, last settlement',
    description:
      'pdcInHand = cheques dated after asOn (not yet counted). pdcEffectiveUncleared = dated on or ' +
      'before asOn, not yet cleared: ALREADY counted as settled — information only. ' +
      'lastSettlement = the latest live ALLOCATION on an owed bill, by voucher. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async party(@Query() q: OutstandingPartyDto): Promise<Ok<PartyCardPayload>> {
    const data = await this.service.party(q);
    return { success: true, message: 'Party card', data };
  }

  @Get('bills')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The open items of one party on asOn (both sides), with the ledger closing',
    description:
      'Ordered by bill date, bill no. adjusted = billAmount − pending. ledgerClosing = the party ' +
      'ledger’s balance on asOn by the Ledger Statement’s definition; a difference from ' +
      'totals.net means a posting moved one without the other. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async bills(@Query() q: OutstandingPartyDto): Promise<Ok<BillsPayload>> {
    const data = await this.service.bills(q);
    return { success: true, message: `${data.rows.length} bill(s)`, data };
  }

  @Get('bill-wise')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Bill-wise tab — open items across parties, paged',
    description:
      'The /bills row plus partyId, partyName, area. sort = date | party | due | refno | pending ' +
      '| age | overdue (default date asc). dueOn = owed bills whose dueEff is that day (the Due ' +
      'calendar’s day click). Totals over every row. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async billWise(@Query() q: OutstandingBillWiseDto): Promise<Ok<BillWisePayload>> {
    const data = await this.service.billWise(q);
    return { success: true, message: `${data.page.totalRows} bill(s)`, data };
  }

  @Get('bill-history')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'What settled one bill — every adjustment row, reversals included (3.0’s grid 580)',
    description:
      'abj_adj_date, abj_row_no order; amounts signed; effective = dated ≤ asOn. tenderAtBill = ' +
      'the counter tender that has no row ("paid at counter").',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'No such bill in the company' })
  async billHistory(@Query() q: OutstandingBillHistoryDto): Promise<Ok<BillHistoryPayload>> {
    const data = await this.service.billHistory(q);
    return { success: true, message: `${data.rows.length} row(s)`, data };
  }

  @Get('summary')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Group / area summary tab',
    description:
      'groupBy = AREA | GROUP (the party ledger’s own group) | SALESMAN (the customer’s default) ' +
      '| BRANCH (the bill’s branch). AREA and SALESMAN are refused on PAYABLE. Totals = the ' +
      '/parties totals. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async summary(@Query() q: OutstandingSummaryDto): Promise<Ok<SummaryPayload>> {
    const data = await this.service.summary(q);
    return { success: true, message: `${data.rows.length} row(s)`, data };
  }

  @Get('due-calendar')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The Due calendar tab — owed bills pending on asOn, by dueEff, at most 92 days',
    description:
      'days lists only the days with something due. overdueBefore = the owed bills whose dueEff ' +
      'is before `from`. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${REFUSALS}, RANGE_TOO_LARGE (> 92 days)`,
  })
  async dueCalendar(@Query() q: OutstandingDueCalendarDto): Promise<Ok<DueCalendarPayload>> {
    const data = await this.service.dueCalendar(q);
    return { success: true, message: `${data.days.length} day(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Rows for the client to print / PDF / Excel / WhatsApp',
    description:
      'shape = PARTIES (the /parties rows unpaged + totals + tiles) | BILLS (the /bill-wise rows ' +
      'unpaged) | PARTY_STATEMENT (one party’s open bills, ageing, net and PDC — "Print bill ' +
      'balance" / the WhatsApp reminder; needs partyId). printedAs = the filters as one sentence. ' +
      'Capped at 20,000 rows — 422 RANGE_TOO_LARGE. Data only: nothing is rendered or sent. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${REFUSALS}, PARTY_REQUIRED, RANGE_TOO_LARGE`,
  })
  async export(@Query() q: OutstandingExportDto): Promise<Ok<ExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} row(s)`, data };
  }
}
