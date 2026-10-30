import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
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
import { LoyaltyStatusService } from './loyalty-status.service';
import {
  LoyaltyStatusCalendarDto,
  LoyaltyStatusExpiringDto,
  LoyaltyStatusExportDto,
  LoyaltyStatusGiftsDto,
  LoyaltyStatusMemberDto,
  LoyaltyStatusMembersDto,
  LoyaltyStatusMonthlyDto,
  LoyaltyStatusSchemesDto,
  LoyaltyStatusStatementDto,
} from './dto/loyalty-status-query.dto';
import type {
  CalendarPayload,
  ExpiringPayload,
  ExportPayload,
  GiftsPayload,
  MemberPayload,
  MembersPayload,
  MonthlyPayload,
  SchemesPayload,
  StatementPayload,
} from './types/loyalty-status.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  '`companyId` is required; `branchId` absent = all branches. "Today" is the company-local date. ' +
  'Needs view on menu 79 (Loyalty Status) — 403 LST_RIGHT_VIEW otherwise.';

/**
 * reports/loyalty-status — plan 2026-10-05 §5. Nine GET routes, all read-only,
 * all self-contained (§3). No cache: a wallet is read to check a bill posted a
 * moment ago.
 */
@ApiTags('Reports — Loyalty Status')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({
  type: HttpErrorResponseDto,
  description: 'LST_RIGHT_VIEW / PRINT / EXPORT',
})
@ApiBadRequestResponse({
  type: HttpErrorResponseDto,
  description: 'BRANCH_NOT_IN_COMPANY, SCHEME_NOT_IN_COMPANY, RANGE_REVERSED, BAD_SORT',
})
@Controller('reports/loyalty-status')
export class LoyaltyStatusController {
  constructor(private readonly service: LoyaltyStatusService) {}

  @Get('members')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 1 — the member grid and its tiles',
    description:
      'One row per wallet: balance, redeemable, cooling, lapsed, value ₹ (each lot at its own ' +
      'scheme rate), next expiry, best gift, eligible. `summary` is over the WHOLE filtered set, ' +
      'never the page. Redeemed on the screen = redeemed + gift. Sort keys: customerName, cardNo, ' +
      'mobile, schemeName, status, earned, redeemed, expired, gift, adjusted, balance, redeemable, ' +
      'cooling, value, nextExpiryOn, lastActivityOn, enrolledOn, branchName. ' +
      SCOPE_NOTE,
  })
  async members(@Query() q: LoyaltyStatusMembersDto): Promise<Ok<MembersPayload>> {
    const data = await this.service.members(q);
    return { success: true, message: `${data.total} member(s)`, data };
  }

  @Get('statement')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 1 bottom left — one member’s ledger with a running balance',
    description:
      'Ordered by date, time, row no, id. `opening` = Σ points before `from`; `closing` = the ' +
      'wallet balance when `to` is today. showReversals=false hides BOTH halves of a reversed ' +
      'pair. The client opens the source document from srcDocType + srcDocId + srcAccYear.',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MEMBER_NOT_FOUND' })
  async statement(@Query() q: LoyaltyStatusStatementDto): Promise<Ok<StatementPayload>> {
    const data = await this.service.statement(q);
    return { success: true, message: `${data.rows.length} row(s)`, data };
  }

  @Get('member')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 1 bottom right — the member card',
    description:
      'The card, balance / redeemable / cooling / lapsed, every open lot in FIFO order with its ' +
      'state, the best gift and its tender value, the scheme’s redeem rules, and `unlotted` = ' +
      'balance − Σ lots.left (shown only when ≠ 0). `redeemable` is LoyaltyLedgerService.redeemable() ' +
      'itself — the till’s number (D1).',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MEMBER_NOT_FOUND' })
  async member(@Query() q: LoyaltyStatusMemberDto): Promise<Ok<MemberPayload>> {
    const data = await this.service.member(q);
    return { success: true, message: 'Loyalty member', data };
  }

  @Get('expiring')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 2 — points lapsing within N days, one row per (member, expiry date)',
    description:
      'Open lots whose expires_on falls in [today, today + withinDays]. `summary.buckets` cut at ' +
      '≤7 / 8–15 / 16–withinDays; `summary.members` counts a member once. Sort keys: expiresOn, ' +
      'daysLeft, points, value, balance, customerName, cardNo, mobile, schemeName, status, ' +
      'lastActivityOn, branchName. No lastSmsOn yet (plan §7.3). ' +
      SCOPE_NOTE,
  })
  async expiring(@Query() q: LoyaltyStatusExpiringDto): Promise<Ok<ExpiringPayload>> {
    const data = await this.service.expiring(q);
    return { success: true, message: `${data.total} row(s)`, data };
  }

  @Get('expiring/calendar')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 2 chart — points lapsing per week',
    description: 'Weeks start on Monday; weeks with nothing lapsing are returned with zeros.',
  })
  async calendar(@Query() q: LoyaltyStatusCalendarDto): Promise<Ok<CalendarPayload>> {
    const data = await this.service.calendar(q);
    return { success: true, message: `${data.weeks.length} week(s)`, data };
  }

  @Get('schemes')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 3 — how each scheme is doing',
    description:
      'Movement by lld_lsc_id in [from, to]: opening, earned, redeemed, gift, expired, adjusted, ' +
      'outstanding (= Σ as on `to`), value, usedPct, bills, holders (as on `to`; NULL on ' +
      'scheme_month; does not total). splitBy = scheme | scheme_branch | scheme_month. A CLOSED / ' +
      'ended scheme stays only while its outstanding > 0 (includeClosedHolding). Not paged. ' +
      'branchId here = where the movement happened (lld_branch_id). ' +
      SCOPE_NOTE,
  })
  async schemes(@Query() q: LoyaltyStatusSchemesDto): Promise<Ok<SchemesPayload>> {
    const data = await this.service.schemes(q);
    return { success: true, message: `${data.total} row(s)`, data };
  }

  @Get('schemes/monthly')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 3 bottom left — one scheme month by month',
    description:
      'Every month between from and to, zeros included; `partial` marks a month the period does ' +
      'not cover whole.',
  })
  async monthly(@Query() q: LoyaltyStatusMonthlyDto): Promise<Ok<MonthlyPayload>> {
    const data = await this.service.monthly(q);
    return { success: true, message: `${data.months.length} month(s)`, data };
  }

  @Get('schemes/gifts')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Tab 3 bottom right — the scheme’s gifts',
    description:
      'eligibleMembers counts ACTIVE members of the scheme whose redeemable ≥ THIS gift’s points. ' +
      'issuedInPeriod = Σ qty of CONFIRMED gift redemptions in [from, to]. inStock = the sale ' +
      'bill’s own stock read (SALEABLE, branch or all), NULL when the gift does not check stock.',
  })
  async gifts(@Query() q: LoyaltyStatusGiftsDto): Promise<Ok<GiftsPayload>> {
    const data = await this.service.gifts(q);
    return { success: true, message: `${data.gifts.length} gift(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A tab’s rows unpaged, with the "Printed as:" line',
    description:
      '`tab` = members | expiring | schemes | statement with that tab’s filters. `printedAs` is ' +
      'built on the server from every filter applied, so a print cannot disagree with the screen. ' +
      'Capped at 20,000 rows (422 RANGE_TOO_LARGE). Data only — the client renders; `format` is ' +
      'echoed. pdf needs print on menu 79, xlsx needs export.',
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: 'RANGE_TOO_LARGE' })
  async export(@Query() q: LoyaltyStatusExportDto): Promise<Ok<ExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} row(s)`, data };
  }
}
