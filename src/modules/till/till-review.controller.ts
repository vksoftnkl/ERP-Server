import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { TillContextService } from './till-context.service';
import { TillExceptionFilter } from './till-exception.filter';
import { TillReviewService } from './services/till-review.service';
import { CreateTillReviewDto, TillReviewListQueryDto } from './dto/till-review.dto';
import { TillErrorResponseDto, TillSuccessDto } from './dto/till-response.dto';
import { TILL_MENU } from './types/till-enum';
import type {
  TillReviewCreatePayload,
  TillReviewListPayload,
  TillSuccessResponse,
} from './types/till-api.types';

/**
 * Notes 134 — head office's review of a business day or a till session, from
 * the Cash Position screen (menu 289). No SUPER ADMIN bypass.
 *
 *   Cash Position (289)   VIEW the reviews · CREATE add one
 */
@ApiTags('Till')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({
  type: TillErrorResponseDto,
  description: 'TILL_RIGHT_VIEW · TILL_RIGHT_CREATE',
})
@Controller('till')
@UseFilters(TillExceptionFilter)
export class TillReviewController {
  constructor(
    private readonly context: TillContextService,
    private readonly reviews: TillReviewService,
  ) {}

  @Post('reviews/create')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Head office reviews a day or a session (notes 134 §2.1)',
    description:
      'Inserts an accounts.till_session_review row: the caller is the reviewer, now the time. Exactly one of ' +
      '`dayId` / `sessionId`, a day / session of this company and branch in `accYear` (404 TILL_DAY_NOT_FOUND / ' +
      'TILL_SESSION_NOT_FOUND otherwise). `note` is required unless the outcome is OK. `refVoucherId` + ' +
      '`refVoucherAccYear` name the journal head office raised, on WRITTEN_OFF / SUSPENSE_CLEARED only: a posted ' +
      'voucher of the company. Never edited: a later review of the same day / session supersedes it (`supersedes` ' +
      'names the one it replaced; the newest is `current`). Journalled HO_REVIEW with the outcome. Cash Position ' +
      '(289) CREATE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiBadRequestResponse({
    type: TillErrorResponseDto,
    description:
      'VALIDATION_* · TILL_REVIEW_TARGET · TILL_NOTE_REQUIRED · TILL_REVIEW_REF_PAIR · TILL_REVIEW_REF_NOT_ALLOWED',
  })
  @ApiNotFoundResponse({
    type: TillErrorResponseDto,
    description: 'TILL_DAY_NOT_FOUND · TILL_SESSION_NOT_FOUND · TILL_REVIEW_REF_NOT_FOUND',
  })
  @ApiConflictResponse({ type: TillErrorResponseDto, description: 'TILL_REVIEW_REF_NOT_POSTED' })
  async create(
    @Body() dto: CreateTillReviewDto,
  ): Promise<TillSuccessResponse<TillReviewCreatePayload>> {
    await this.context.requireRight(TILL_MENU.CASH_POSITION, 'create', 'add a head office review');
    const data = await this.reviews.create({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      dayId: dto.dayId ?? null,
      sessionId: dto.sessionId ?? null,
      outcome: dto.outcome,
      note: dto.note ?? null,
      refVoucherId: dto.refVoucherId ?? null,
      refVoucherAccYear: dto.refVoucherAccYear ?? null,
    });
    return {
      success: true,
      message: `${data.review.outcome} review of ${data.review.sessionNo ?? data.review.businessDate} recorded`,
      data,
    };
  }

  @Get('reviews/list')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A branch’s head office reviews, newest first (notes 134 §2.2)',
    description:
      'Every review of the branch, or of one day (`dayId`) or one session (`sessionId`). `current` marks the ' +
      'newest of each day / session. Cash Position (289) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async list(
    @Query() query: TillReviewListQueryDto,
  ): Promise<TillSuccessResponse<TillReviewListPayload>> {
    await this.context.requireRight(TILL_MENU.CASH_POSITION, 'view', 'see the head office reviews');
    const data = await this.reviews.list({
      companyId: query.companyId,
      branchId: query.branchId,
      dayId: query.dayId ?? null,
      sessionId: query.sessionId ?? null,
    });
    return { success: true, message: `${data.reviews.length} review(s)`, data };
  }
}
