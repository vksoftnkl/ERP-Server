import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import type { StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { AgeingSlabsCompanyDto, SaveAgeingSlabsDto } from './dto/ageing-slabs.dto';
import { AgeingSlabsService, type AgeingSlabLadder } from './ageing-slabs.service';

/**
 * Menu 294 "Ageing Slabs" (notes 159 §3): VIEW reads the ladder, EDIT saves or
 * reverts it. No row, no rights — SUPER ADMIN included. 403 `AGE_RIGHT_<RIGHT>`.
 */
export const AGEING_SLABS_MENU_ID = 294;

/** `stock.stock_ageing_slab` — one ladder per company, saved whole (notes 159 §3). */
@ApiTags('Ageing Slabs')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'AGE_RIGHT_VIEW / AGE_RIGHT_EDIT on menu 294.' })
@Controller('stock/ageing-slabs')
@UseFilters(StockVoucherExceptionFilter)
export class AgeingSlabsController {
  constructor(
    private readonly service: AgeingSlabsService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary: "The company's ageing ladder",
    description:
      "The company's own slabs if it has any (usingOwn true), otherwise the shared default (company NULL) — never a mixture.",
  })
  @ApiOkResponse({ description: '{ usingOwn, slabs: [{ slabNo, label, fromDays, toDays|null }] }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async get(@Query() query: AgeingSlabsCompanyDto): Promise<StockVoucherSuccessResponse<AgeingSlabLadder>> {
    await this.requireRight('view', 'view the ageing slabs');
    const data = await this.service.get(query.companyId);
    return { success: true, message: 'Ageing slabs fetched successfully', data };
  }

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Replace the company's whole ladder",
    description:
      'One transaction (ex_sag_overlap deferred) retires every company row and writes the ladder sent. Refused 422 per field (slabs.<i>.fromDays, .toDays, .label, .slabNo; slabs for the count) unless the first slab starts at 0, each starts the day after the previous ends, exactly one slab is open-ended and it is the last, labels are non-blank and unique, there are 1–20 slabs and slabNo runs 1..n. "Customise" = this save with a copy of the default.',
  })
  @ApiCreatedResponse({ description: 'The ladder as saved (usingOwn true).' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  async save(@Body() dto: SaveAgeingSlabsDto): Promise<StockVoucherSuccessResponse<AgeingSlabLadder>> {
    await this.requireRight('edit', 'save the ageing slabs');
    const data = await this.service.save(dto);
    return { success: true, message: 'Ageing slabs saved successfully', data };
  }

  @Post('revert')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Drop the company's own ladder; the shared default applies again",
  })
  @ApiCreatedResponse({ description: 'The ladder now in force (usingOwn false).' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async revert(@Body() dto: AgeingSlabsCompanyDto): Promise<StockVoucherSuccessResponse<AgeingSlabLadder>> {
    await this.requireRight('edit', 'revert the ageing slabs');
    const data = await this.service.revert(dto.companyId);
    return { success: true, message: 'Ageing slabs reverted to the default', data };
  }

  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: AGEING_SLABS_MENU_ID,
      right,
      codePrefix: 'AGE',
      action,
    });
  }
}
