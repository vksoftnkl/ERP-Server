import { Body, Controller, Get, Post, Query, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import { DeactivateStockTrackPresetDto, SaveStockTrackPresetDto } from './dto/save-stock-track-preset.dto';
import {
  StockTrackPresetsErrorResponseDto,
  StockTrackPresetsSuccessGetDto,
  StockTrackPresetsSuccessOneDto,
} from './dto/stock-track-presets-response.dto';
import { StockTrackPresetsService } from './stock-track-presets.service';
import {
  StockTrackPresetsGetMeta,
  StockTrackPresetsPayload,
  StockTrackPresetsSuccessResponse,
} from './types/stock-track-presets-api.types';
/**
 * Menu 249 "Tracking Presets". The writes (notes 159 §4) are judged on it: a
 * create needs CREATE, an update or a (re)activation EDIT — 403
 * `SPT_RIGHT_<RIGHT>`, no row no rights. The GET stays open to any login: it
 * feeds the preset combo on Item Master and Item Group Master, whose users
 * need not hold 249.
 */
export const TRACKING_PRESETS_MENU_ID = 249;

// No @CacheTTL: the list changes through save / deactivate, and a cached GET
// would show the screen the row it just replaced.
@ApiTags('Stock Track Presets')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock-track-presets')
export class StockTrackPresetsController {
  constructor(
    private readonly stockTrackPresetsService: StockTrackPresetsService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Stock tracking presets a company may pick from — its own plus the shared ones it has not overridden. Feeds the preset combo on Item Master and Item Group Master; the chosen spt_id is what those screens save. usedByItems / usedByGroups count the items and groups naming each preset; above 0 its flags, valuation and code are locked.',
  })
  @ApiOkResponse({ type: StockTrackPresetsSuccessGetDto })
  @ApiBadRequestResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTrackPresetsErrorResponseDto })
  async get(
    @Query() queryDto: GetStockTrackPresetsQueryDto,
  ): Promise<
    StockTrackPresetsSuccessResponse<StockTrackPresetsPayload[], StockTrackPresetsGetMeta>
  > {
    const result = await this.stockTrackPresetsService.get(queryDto);
    return {
      success: true,
      message: queryDto.spt_id
        ? 'Stock track preset fetched successfully'
        : 'Stock track presets fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Create (no sptId) or update the company's own preset",
    description:
      'A shared preset (company NULL) is read-only (409 STOCK_PRESET_SHARED_READ_ONLY): create the company\'s own with the same code to override it. On an update a field left out keeps its value. Once any item or group uses the preset, the six track flags, the valuation and the code are fixed (409 STOCK_PRESET_IN_USE, one detail per field). 422: expiry needs batch, FEFO needs expiry on a batch-tracked preset, valuation is LOT_ACTUAL when anything is tracked else WAVG (derived when left out), code and name on a create. 409 STOCK_PRESET_CODE_TAKEN for a code the company already has.',
  })
  @ApiCreatedResponse({ type: StockTrackPresetsSuccessOneDto })
  @ApiBadRequestResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiForbiddenResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiConflictResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: StockTrackPresetsErrorResponseDto })
  async save(
    @Body() dto: SaveStockTrackPresetDto,
  ): Promise<StockTrackPresetsSuccessResponse<StockTrackPresetsPayload>> {
    await this.requireRight(dto.sptId ? 'edit' : 'create', dto.sptId ? 'edit a tracking preset' : 'create a tracking preset');
    const data = await this.stockTrackPresetsService.save(dto);
    return {
      success: true,
      message: dto.sptId ? 'Stock track preset updated successfully' : 'Stock track preset created successfully',
      data,
    };
  }

  @Post('deactivate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Deactivate (or, with reactivate, reactivate) the company's own preset",
    description:
      'Refused 409 STOCK_PRESET_IN_USE while any active item or group uses it; a shared preset is read-only (409).',
  })
  @ApiCreatedResponse({ type: StockTrackPresetsSuccessOneDto })
  @ApiBadRequestResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiForbiddenResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiConflictResponse({ type: StockTrackPresetsErrorResponseDto })
  async deactivate(
    @Body() dto: DeactivateStockTrackPresetDto,
  ): Promise<StockTrackPresetsSuccessResponse<StockTrackPresetsPayload>> {
    await this.requireRight('edit', dto.reactivate ? 'reactivate a tracking preset' : 'deactivate a tracking preset');
    const data = await this.stockTrackPresetsService.deactivate(dto);
    return {
      success: true,
      message: data.spt_is_active ? 'Stock track preset reactivated' : 'Stock track preset deactivated',
      data,
    };
  }

  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: TRACKING_PRESETS_MENU_ID,
      right,
      codePrefix: 'SPT',
      action,
    });
  }
}
