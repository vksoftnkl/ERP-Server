import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Version } from '@nestjs/common';
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
import { API_VERSION } from '../../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../../common/dto/http-error-response.dto';
import type { LoyaltyAdjustResult } from '../../posting/types/loyalty.types';
import {
  LoyaltyMemberAdjustDto,
  LoyaltyMemberHistoryDto,
  LoyaltyMemberStatusDto,
} from './dto/loyalty-member-action.dto';
import {
  LoyaltyMembersService,
  type HistoryStep,
  type StatusChangeResult,
} from './loyalty-members.service';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

/**
 * The Loyalty Status screen's actions (plan 2026-10-05 §7) — own URLs, not
 * under /reports. Judged on menu 79: edit for both actions, delete as well for
 * a forced close, view for the trail.
 */
@ApiTags('Loyalty — Members')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({
  type: HttpErrorResponseDto,
  description: 'LST_RIGHT_EDIT / LST_RIGHT_DELETE / LST_RIGHT_VIEW',
})
@ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'LOYALTY_MEMBER_NOT_FOUND' })
@Controller('loyalty/members')
export class LoyaltyMembersController {
  constructor(private readonly service: LoyaltyMembersService) {}

  @Post('status')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend, reactivate or close a wallet',
    description:
      'Writes lmb_status / lmb_block_reason and one txn_status_log step; no ledger row. MERGED is ' +
      'not settable. CLOSED with a balance ≠ 0 is refused (422 LOYALTY_MEMBER_HAS_BALANCE) unless ' +
      '`force` is sent with `approvedBy` — then the wallet is written off first, one ADJUST row ' +
      'per open lot, and `drained` reports it (D6).',
  })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'LOYALTY_MEMBER_REASON_REQUIRED, LOYALTY_MEMBER_APPROVER_REQUIRED',
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'LOYALTY_MEMBER_HAS_BALANCE, LOYALTY_MEMBER_NO_CHANGE, LOYALTY_MEMBER_MERGED',
  })
  async status(@Body() dto: LoyaltyMemberStatusDto): Promise<Ok<StatusChangeResult>> {
    const data = await this.service.setStatus(dto);
    return { success: true, message: `Member ${data.toStatus}`, data };
  }

  @Post('adjust')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adjust a wallet’s points, with an approver',
    description:
      'ONE adjustment document through LoyaltyLedgerService.adjust(). Positive = a lot (never ' +
      'lapses unless expiresOn). Negative = FIFO through the lots like a redeem, refused beyond ' +
      'the redeemable balance (422 SALES_LOYALTY_CAP). approvedBy is required by the DTO — a 400 ' +
      'before the database answers.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: 'SALES_LOYALTY_CAP' })
  async adjust(@Body() dto: LoyaltyMemberAdjustDto): Promise<Ok<LoyaltyAdjustResult>> {
    const data = await this.service.adjust(dto);
    return { success: true, message: `${data.rowsWritten} ledger row(s) written`, data };
  }

  @Get('history')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Ctrl+H — the member’s status trail',
    description: 'The txn_status_log steps written by /status, oldest first.',
  })
  async history(
    @Query() q: LoyaltyMemberHistoryDto,
  ): Promise<Ok<{ memberId: string; steps: HistoryStep[] }>> {
    const data = await this.service.history(q);
    return { success: true, message: `${data.steps.length} step(s)`, data };
  }
}
