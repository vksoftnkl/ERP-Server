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
import { GodownPositionService } from './godown-position.service';
import {
  GodownPositionBehindDto,
  GodownPositionExportDto,
  GodownPositionQueryDto,
} from './dto/godown-position-query.dto';
import type {
  BehindPayload,
  PositionExportPayload,
  PositionPayload,
} from './types/godown-position.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'Per item × godown of one branch, TODAY: Physical = Owned (stock_balance on hand) + Billed not ' +
  'delivered (Σ open Pickup / Dispatch bill lines of the godown − their delivery events). Free to ' +
  'sell = stock_balance available. Challan out = posted challans’ open qty. On vehicle is phase 2 ' +
  '(null). Quantities 3 dp in the Qty-in unit (the selling unit by default, Q16), kg 3 dp. ' +
  'Needs view on menu 306 — 403 GODOWN_POSITION_RIGHT_VIEW.';

const REFUSALS =
  'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY, GODOWN_POSITION_GODOWN_NOT_IN_BRANCH, ' +
  'STOCK_SUMMARY_GROUP_NOT_FOUND, STOCK_SUMMARY_BRAND_NOT_FOUND (in that order)';

/**
 * stock/reports/godown-position — delivery tracking plan §8.3 (menu 306).
 * Three GET routes, read-only, with their own DTOs. No HTTP cache anywhere:
 * the answer depends on the caller's rights and on now.
 */
@ApiTags('Stock Reports — Godown Stock Position')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'GODOWN_POSITION_RIGHT_VIEW' })
@Controller('stock/reports/godown-position')
export class GodownPositionController {
  constructor(private readonly service: GodownPositionService) {}

  @Get()
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Show: head, tiles, one row per item × godown, kg totals, rights',
    description: SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async show(@Query() q: GodownPositionQueryDto): Promise<Ok<PositionPayload>> {
    const data = await this.service.show(q);
    return { success: true, message: `${data.rows.length} row(s)`, data };
  }

  @Get('behind')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'What is behind one row’s figure: the open bill lines (BND) or challans, + the row by lot',
    description:
      'kind BND: the open bill lines of the item in the godown (billed, given, pending in the row’s ' +
      'Qty-in unit), oldest bill first; kind CHALLAN: the posted challans with open qty. byLot: ' +
      'owned + not delivered = physical per lot; sum: the row. ' +
      SCOPE_NOTE,
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: `${REFUSALS}, STOCK_SUMMARY_ITEM_NOT_FOUND`,
  })
  async behind(@Query() q: GodownPositionBehindDto): Promise<Ok<BehindPayload>> {
    const data = await this.service.behind(q);
    return { success: true, message: `${data.rows.length} row(s)`, data };
  }

  @Get('export')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Every row of a Show for Excel and print, with printedAs (the first line)',
    description:
      'Show’s keys and answer plus printedAs and totalRows, numbers unformatted (as the Stock ' +
      'Summary export). Needs VIEW and EXPORT on 306 (403 GODOWN_POSITION_RIGHT_EXPORT). ' +
      SCOPE_NOTE,
  })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'GODOWN_POSITION_RIGHT_VIEW, GODOWN_POSITION_RIGHT_EXPORT',
  })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async export(@Query() q: GodownPositionExportDto): Promise<Ok<PositionExportPayload>> {
    const data = await this.service.export(q);
    return { success: true, message: `${data.totalRows} row(s)`, data };
  }
}
