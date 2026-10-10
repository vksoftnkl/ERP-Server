import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import type { MenuRight } from '../../common/posting/rights';
import { TillContextService } from './till-context.service';
import { TillExceptionFilter } from './till-exception.filter';
import { TillMastersService } from './services/till-masters.service';
import {
  SaveTillApprovalAuthorityDto,
  SaveTillApprovalRuleDto,
  SaveTillCounterDto,
  SaveTillDenominationDto,
  SaveTillReasonDto,
  SaveTillSafeDto,
  TillDenominationListQueryDto,
  TillMasterKeyQueryDto,
} from './dto/save-till-masters.dto';
import { TillErrorResponseDto, TillListSuccessDto, TillSuccessDto } from './dto/till-response.dto';
import { TILL_MENU } from './types/till-enum';
import type {
  TillApprovalAuthorityPayload,
  TillApprovalRulePayload,
  TillCounterPayload,
  TillDeletePayload,
  TillDenominationPayload,
  TillReasonPayload,
  TillSafePayload,
  TillSuccessResponse,
} from './types/till-api.types';

/**
 * The till masters (S10), each judged on its own menu since the four screens
 * split (notes 101): counters — Till Counters (275), safes — Till Safes (280),
 * reasons — Till Reasons (281), denominations — Denominations (282); approval
 * rules and approval authority — Till Approval Setup (276), granted apart
 * because "who may approve what, up to how much" is a control in its own right. `/create` is CREATE without an id and EDIT with
 * one. Lists are the configured grids, not routes; /denominations/list is the
 * one exception, because a count screen needs the set before it can draw.
 */
@ApiTags('Till Masters')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: TillErrorResponseDto })
@Controller('till')
@UseFilters(TillExceptionFilter)
export class TillMastersController {
  constructor(
    private readonly context: TillContextService,
    private readonly masters: TillMastersService,
  ) {}

  // ── Counter ──────────────────────────────────────────────────────────────

  @Post('counters/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a counter (by tcnId presence)',
    description: 'Till Counters (275) CREATE / EDIT.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  @ApiBadRequestResponse({ type: TillErrorResponseDto })
  async saveCounter(
    @Body() dto: SaveTillCounterDto,
  ): Promise<TillSuccessResponse<TillCounterPayload>> {
    await this.requireSave(TILL_MENU.COUNTERS, dto.tcnId, 'till counters');
    const data = await this.masters.saveCounter(dto);
    return {
      success: true,
      message: dto.tcnId ? `Counter ${data.tcnCode} updated` : `Counter ${data.tcnCode} created`,
      data,
    };
  }

  @Get('counters/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({ summary: 'One counter', description: 'Till Counters (275) VIEW.' })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  async getCounter(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillCounterPayload>> {
    await this.context.requireRight(TILL_MENU.COUNTERS, 'view', 'view till counters');
    return {
      success: true,
      message: 'Counter fetched',
      data: await this.masters.getCounter(q.id, q.companyId),
    };
  }

  @Delete('counters/delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft-delete a counter (refused while a session is live on it)',
    description: 'Till Counters (275) DELETE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async deleteCounter(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDeletePayload>> {
    await this.context.requireRight(TILL_MENU.COUNTERS, 'delete', 'delete till counters');
    return {
      success: true,
      message: 'Counter deleted',
      data: await this.masters.deleteCounter(q.id, q.companyId),
    };
  }

  // ── Safe ─────────────────────────────────────────────────────────────────

  @Post('safes/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a safe (by tsfId presence)',
    description:
      'No ledger named on a new safe = the SAFE_CASH role’s ledger. Till Safes (280) CREATE / EDIT.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  @ApiBadRequestResponse({ type: TillErrorResponseDto })
  async saveSafe(@Body() dto: SaveTillSafeDto): Promise<TillSuccessResponse<TillSafePayload>> {
    await this.requireSave(TILL_MENU.SAFES, dto.tsfId, 'till safes');
    const data = await this.masters.saveSafe(dto);
    return {
      success: true,
      message: dto.tsfId ? `Safe ${data.tsfCode} updated` : `Safe ${data.tsfCode} created`,
      data,
    };
  }

  @Get('safes/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({ summary: 'One safe', description: 'Till Safes (280) VIEW.' })
  @ApiOkResponse({ type: TillSuccessDto })
  async getSafe(@Query() q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillSafePayload>> {
    await this.context.requireRight(TILL_MENU.SAFES, 'view', 'view till safes');
    return {
      success: true,
      message: 'Safe fetched',
      data: await this.masters.getSafe(q.id, q.companyId),
    };
  }

  @Delete('safes/delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft-delete a safe (refused while a counter drops into it)',
    description: 'Till Safes (280) DELETE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async deleteSafe(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDeletePayload>> {
    await this.context.requireRight(TILL_MENU.SAFES, 'delete', 'delete till safes');
    return {
      success: true,
      message: 'Safe deleted',
      data: await this.masters.deleteSafe(q.id, q.companyId),
    };
  }

  // ── Reason ───────────────────────────────────────────────────────────────

  @Post('reasons/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a company reason (by trsId presence)',
    description: 'Shipped (shared) reasons are read-only. Till Reasons (281) CREATE / EDIT.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  async saveReason(
    @Body() dto: SaveTillReasonDto,
  ): Promise<TillSuccessResponse<TillReasonPayload>> {
    await this.requireSave(TILL_MENU.REASONS, dto.trsId, 'till reasons');
    const data = await this.masters.saveReason(dto);
    return { success: true, message: dto.trsId ? 'Reason updated' : 'Reason created', data };
  }

  @Get('reasons/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One reason (a company row or a shipped one)',
    description: 'Till Reasons (281) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async getReason(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillReasonPayload>> {
    await this.context.requireRight(TILL_MENU.REASONS, 'view', 'view till reasons');
    return {
      success: true,
      message: 'Reason fetched',
      data: await this.masters.getReason(q.id, q.companyId),
    };
  }

  @Delete('reasons/delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft-delete a company reason',
    description: 'Till Reasons (281) DELETE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async deleteReason(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDeletePayload>> {
    await this.context.requireRight(TILL_MENU.REASONS, 'delete', 'delete till reasons');
    return {
      success: true,
      message: 'Reason deleted',
      data: await this.masters.deleteReason(q.id, q.companyId),
    };
  }

  // ── Denomination ─────────────────────────────────────────────────────────

  @Post('denominations/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a company denomination (by tdnId presence)',
    description: 'Denominations (282) CREATE / EDIT.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  async saveDenomination(
    @Body() dto: SaveTillDenominationDto,
  ): Promise<TillSuccessResponse<TillDenominationPayload>> {
    await this.requireSave(TILL_MENU.DENOMINATIONS, dto.tdnId, 'denominations');
    const data = await this.masters.saveDenomination(dto);
    return {
      success: true,
      message: dto.tdnId ? 'Denomination updated' : 'Denomination created',
      data,
    };
  }

  @Get('denominations/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({ summary: 'One denomination', description: 'Denominations (282) VIEW.' })
  @ApiOkResponse({ type: TillSuccessDto })
  async getDenomination(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDenominationPayload>> {
    await this.context.requireRight(TILL_MENU.DENOMINATIONS, 'view', 'view denominations');
    return {
      success: true,
      message: 'Denomination fetched',
      data: await this.masters.getDenomination(q.id, q.companyId),
    };
  }

  @Get('denominations/list')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The notes and coins a count offers this company, in screen order',
    description:
      'Its own rows and the shipped ones valid today; a company row replaces the shipped row of the same value. ' +
      'Open Till (272) VIEW or Denominations (282) VIEW.',
  })
  @ApiOkResponse({ type: TillListSuccessDto })
  async listDenominations(
    @Query() q: TillDenominationListQueryDto,
  ): Promise<TillSuccessResponse<TillDenominationPayload[]>> {
    const till = await this.context.rights(TILL_MENU.OPEN_TILL);
    if (!till.view) {
      await this.context.requireRight(TILL_MENU.DENOMINATIONS, 'view', 'view denominations');
    }
    const data = await this.masters.listDenominations(q.companyId);
    return { success: true, message: `${data.length} denomination(s)`, data };
  }

  @Delete('denominations/delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft-delete a company denomination',
    description: 'Denominations (282) DELETE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async deleteDenomination(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDeletePayload>> {
    await this.context.requireRight(TILL_MENU.DENOMINATIONS, 'delete', 'delete denominations');
    return {
      success: true,
      message: 'Denomination deleted',
      data: await this.masters.deleteDenomination(q.id, q.companyId),
    };
  }

  // ── Approval rule ────────────────────────────────────────────────────────

  @Post('approval-rules/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a company / branch approval rule (by tarId presence)',
    description:
      'A branch rule beats the company rule, which beats the shipped one. Till Approval Setup (276) CREATE / EDIT.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  async saveRule(
    @Body() dto: SaveTillApprovalRuleDto,
  ): Promise<TillSuccessResponse<TillApprovalRulePayload>> {
    await this.requireSave(TILL_MENU.APPROVAL_SETUP, dto.tarId, 'till approval rules');
    const data = await this.masters.saveRule(dto);
    return {
      success: true,
      message: dto.tarId ? 'Approval rule updated' : 'Approval rule created',
      data,
    };
  }

  @Get('approval-rules/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({ summary: 'One approval rule', description: 'Till Approval Setup (276) VIEW.' })
  @ApiOkResponse({ type: TillSuccessDto })
  async getRule(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillApprovalRulePayload>> {
    await this.context.requireRight(TILL_MENU.APPROVAL_SETUP, 'view', 'view till approval rules');
    return {
      success: true,
      message: 'Approval rule fetched',
      data: await this.masters.getRule(q.id, q.companyId),
    };
  }

  @Delete('approval-rules/delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft-delete a company / branch approval rule',
    description: 'Till Approval Setup (276) DELETE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async deleteRule(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDeletePayload>> {
    await this.context.requireRight(
      TILL_MENU.APPROVAL_SETUP,
      'delete',
      'delete till approval rules',
    );
    return {
      success: true,
      message: 'Approval rule deleted',
      data: await this.masters.deleteRule(q.id, q.companyId),
    };
  }

  // ── Approval authority ───────────────────────────────────────────────────

  @Post('approval-authorities/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Grant or change an approval authority (by taaId presence)',
    description:
      'Who may approve which event, at which level, up to how much, and whether remotely. Till Approval Setup (276) CREATE / EDIT.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  async saveAuthority(
    @Body() dto: SaveTillApprovalAuthorityDto,
  ): Promise<TillSuccessResponse<TillApprovalAuthorityPayload>> {
    await this.requireSave(TILL_MENU.APPROVAL_SETUP, dto.taaId, 'till approval authority');
    const data = await this.masters.saveAuthority(dto);
    return {
      success: true,
      message: dto.taaId ? 'Approval authority updated' : 'Approval authority granted',
      data,
    };
  }

  @Get('approval-authorities/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One approval authority grant',
    description: 'Till Approval Setup (276) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async getAuthority(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillApprovalAuthorityPayload>> {
    await this.context.requireRight(
      TILL_MENU.APPROVAL_SETUP,
      'view',
      'view till approval authority',
    );
    return {
      success: true,
      message: 'Approval authority fetched',
      data: await this.masters.getAuthority(q.id, q.companyId),
    };
  }

  @Delete('approval-authorities/delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Withdraw an approval authority grant',
    description: 'Till Approval Setup (276) DELETE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async deleteAuthority(
    @Query() q: TillMasterKeyQueryDto,
  ): Promise<TillSuccessResponse<TillDeletePayload>> {
    await this.context.requireRight(
      TILL_MENU.APPROVAL_SETUP,
      'delete',
      'withdraw till approval authority',
    );
    return {
      success: true,
      message: 'Approval authority withdrawn',
      data: await this.masters.deleteAuthority(q.id, q.companyId),
    };
  }

  /** CREATE for a new row, EDIT for an existing one. */
  private async requireSave(menuId: number, id: string | undefined, what: string): Promise<void> {
    const right: MenuRight = id ? 'edit' : 'create';
    await this.context.requireRight(menuId, right, `${id ? 'edit' : 'create'} ${what}`);
  }
}
