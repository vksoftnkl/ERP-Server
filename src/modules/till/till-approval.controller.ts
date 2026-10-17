import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { TillContextService } from './till-context.service';
import { TillExceptionFilter } from './till-exception.filter';
import { TillApprovalGateService } from './services/till-approval-gate.service';
import {
  CancelTillApprovalDto,
  DecideTillApprovalDto,
  RequestTillApprovalDto,
  TillApprovalKeyDto,
} from './dto/till-approval.dto';
import { TillScopeDto } from './dto/till-session.dto';
import { TillErrorResponseDto, TillSuccessDto } from './dto/till-response.dto';
import { TILL_MENU } from './types/till-enum';
import type {
  TillApprovalInboxPayload,
  TillApprovalPayload,
  TillSuccessResponse,
} from './types/till-api.types';

/**
 * Notes 124 §5 — the approval gate (notes 105 Part B): a request, its
 * decision, and the approvers' inbox. Who may decide is the Till Approval
 * Authority (285) grant `assertApprover` judges; the menu rights below only
 * open the routes.
 *
 *   request          Open Till (272) VIEW, or Till Sessions (273) VIEW
 *   decide           Till Sessions (273) OVERRIDE (as decide-variance)
 *   cancel · get     272 VIEW or 273 VIEW (cancel: whoever asked, or 273 OVERRIDE)
 *   pending          273 VIEW
 */
@ApiTags('Till')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: TillErrorResponseDto })
@Controller('till')
@UseFilters(TillExceptionFilter)
export class TillApprovalController {
  constructor(
    private readonly context: TillContextService,
    private readonly gate: TillApprovalGateService,
  ) {}

  @Post('approvals/request')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ask for an approval — PENDING for an approver, or decided at once at the counter',
    description:
      'A till_approval row for an event (ck_tap_event) and an amount under the event’s rule (a branch row beats a ' +
      'company row beats the shipped one; none = SUPERVISOR, EITHER). The rule as it stands is kept with the ' +
      'request, so a decision is judged by the bar that stood when it was asked. `srcDocType` / `srcDocId` name ' +
      'what it unlocks — what a 428 TILL_APPROVAL_REQUIRED named; the same caller asking again for the same ' +
      'document gets the PENDING request back. `approverId` + `approverPin` (+ `secondId` / `secondPin` on a ' +
      'two-person rule): the approver standing at the counter decides it in this call (COUNTER channel). A rule ' +
      'that asks nothing for the amount → 422 TILL_APPROVAL_INVALID (`needed: false`). `tar_expire_minutes` > 0 ' +
      'gives the request an expiry. APPROVAL_REQUESTED journalled. Open Till (272) VIEW or Till Sessions (273) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiUnprocessableEntityResponse({
    type: TillErrorResponseDto,
    description: 'TILL_APPROVAL_INVALID · TILL_REASON_INVALID · TILL_APPROVER_NO_PIN',
  })
  async request(
    @Body() dto: RequestTillApprovalDto,
  ): Promise<TillSuccessResponse<TillApprovalPayload>> {
    await this.requireAny(
      [
        [TILL_MENU.OPEN_TILL, 'view'],
        [TILL_MENU.SESSIONS, 'view'],
      ],
      'ask for a till approval',
    );
    const data = await this.gate.request(dto);
    return {
      success: true,
      message:
        data.status === 'APPROVED'
          ? `${data.event} approved by ${data.decidedByName ?? 'the approver'}`
          : `${data.event} waits for an approver (${data.requiredRole} or above)`,
      data,
    };
  }

  @Post('approvals/decide')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve or reject a PENDING request — the caller is the approver',
    description:
      '`assertApprover` against the request’s snapshot rule: not whoever asked (403 TILL_APPROVER_SELF unless the ' +
      'rule or till.single_operator allows it), a 285 grant at the level for the event covering the amount ' +
      '(TILL_APPROVER_NO_GRANT / _LIMIT; a SUPER ADMIN is an implicit HO_FINANCE grant), the channel (COUNTER: ' +
      '`approverPin`; REMOTE: a remote grant — TILL_APPROVER_PIN, a wrong PIN journalled PIN_FAIL). APPROVE on a ' +
      'two-person rule takes `secondId` + `secondPin` (403 TILL_APPROVER_SECOND). Not PENDING → 409 ' +
      'TILL_APPROVAL_NOT_PENDING; past its expiry → 409 TILL_APPROVAL_EXPIRED (swept to EXPIRED). An approved ' +
      'FLOAT_MISMATCH filed at an open is recorded on its variance. APPROVAL_DECIDED journalled. Till Sessions ' +
      '(273) OVERRIDE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description: 'TILL_APPROVAL_NOT_PENDING · TILL_APPROVAL_EXPIRED',
  })
  async decide(
    @Body() dto: DecideTillApprovalDto,
  ): Promise<TillSuccessResponse<TillApprovalPayload>> {
    await this.context.requireRight(TILL_MENU.SESSIONS, 'override', 'decide a till approval');
    const data = await this.gate.decide(dto);
    return { success: true, message: `${data.event} ${data.status.toLowerCase()}`, data };
  }

  @Post('approvals/cancel')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Withdraw a PENDING request',
    description:
      'Whoever asked; anyone else needs Till Sessions (273) OVERRIDE (403 TILL_APPROVAL_NOT_YOURS). CANCELLED, ' +
      'journalled as APPROVAL_DECIDED with status CANCELLED. Not PENDING → 409 TILL_APPROVAL_NOT_PENDING.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async cancel(
    @Body() dto: CancelTillApprovalDto,
  ): Promise<TillSuccessResponse<TillApprovalPayload>> {
    await this.requireAny(
      [
        [TILL_MENU.OPEN_TILL, 'view'],
        [TILL_MENU.SESSIONS, 'view'],
      ],
      'cancel a till approval',
    );
    const data = await this.gate.cancel(dto);
    return { success: true, message: `${data.event} request cancelled`, data };
  }

  @Get('approvals/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One approval request: its status, who asked, who decided, whether a document has used it',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  async get(
    @Query() query: TillApprovalKeyDto,
  ): Promise<TillSuccessResponse<TillApprovalPayload>> {
    await this.requireAny(
      [
        [TILL_MENU.OPEN_TILL, 'view'],
        [TILL_MENU.SESSIONS, 'view'],
      ],
      'view a till approval',
    );
    const data = await this.gate.get(query);
    return { success: true, message: `${data.event}: ${data.status}`, data };
  }

  @Get('approvals/pending')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The approvers’ inbox: everything in the branch waiting for a decision, and where to decide it',
    description:
      'kind REQUEST (approvals/decide) · SESSION_VARIANCE (sessions/decide-variance: PENDING_APPROVAL, and a ' +
      'CLOSED session whose drawer gap was left undecided — `afterClose`) · RECEIVE_VARIANCE (decide-variance with ' +
      '`tcmId`) · SAFE_VARIANCE (safes/decide-variance). Each with the event, the rule’s level and channel, who ' +
      'asked and when, and `canDecide` / `cannotBecause` for the caller’s own authority (no PIN asked here). A ' +
      'variance’s amount is null without Till Sessions (273) OVERRIDE (the count is blind). Requests past their ' +
      'expiry are swept to EXPIRED first (`expired`). Till Sessions (273) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async pending(
    @Query() query: TillScopeDto,
  ): Promise<TillSuccessResponse<TillApprovalInboxPayload>> {
    await this.context.requireRight(TILL_MENU.SESSIONS, 'view', 'see the approvals inbox');
    const data = await this.gate.pending(query);
    return {
      success: true,
      message: `${data.items.length} decision(s) waiting`,
      data,
    };
  }

  private async requireAny(
    options: [number, 'view' | 'create' | 'override'][],
    action: string,
  ): Promise<void> {
    for (const [menuId, right] of options) {
      if ((await this.context.rights(menuId))[right]) {
        return;
      }
    }
    const [menuId, right] = options[0];
    await this.context.requireRight(menuId, right, action);
  }
}
