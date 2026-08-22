import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import {
  DeletePromotionSchemeQueryDto,
  PromotionSchemeEligibilityQueryDto,
  PromotionSchemeIdQueryDto,
} from './dto/promotion-scheme-id-query.dto';
import {
  PromotionSchemeEligibilitySuccessDto,
  PromotionSchemeErrorResponseDto,
  PromotionSchemeSuccessDeleteDto,
  PromotionSchemeSuccessSingleDto,
} from './dto/promotion-scheme-response.dto';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import { PromotionSchemeExceptionFilter } from './promotion-scheme-exception.filter';
import { PromotionSchemeService } from './promotion-scheme.service';
import {
  PromotionSchemeDeleteResult,
  PromotionSchemeEligibilityPayload,
  PromotionSchemePayload,
  PromotionSchemeSuccessResponse,
} from './types/promotion-scheme-api.types';

/**
 * One module, five tables, one URL.
 *
 * POST /create saves the campaign whole: the header plus the four scope/band
 * grids (branches, parties, items, slabs) nested in the same body, in one
 * transaction. GET /get returns the same shape back, names resolved and ready
 * to edit. There is deliberately no per-grid endpoint — a grid row is created,
 * changed and removed by posting the array it belongs to.
 */
@ApiTags('Promotion Scheme')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('promotion-scheme')
@UseFilters(PromotionSchemeExceptionFilter)
export class PromotionSchemeController {
  constructor(private readonly promotionSchemeService: PromotionSchemeService) {}

  // ─── §1 the campaign header ─────────────────────────────────────────────────

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a whole promotion scheme — header and all four grids — in one call',
    description:
      'Object payload. Omit prm_id to create, send it to update — on update only the keys present ' +
      'in the body are written.\n\n' +
      'The `branches`, `parties`, `items` and `slabs` arrays are optional and save with the ' +
      'header in the same transaction. An array that is present REPLACES that grid: rows ' +
      'carrying their own id are updated, rows without one are inserted, and rows already on the ' +
      'scheme but missing from the array are soft deleted. Omit the key to leave the grid ' +
      'untouched — `"items": []` means "delete every item row", which is not the same thing.',
  })
  @ApiCreatedResponse({ type: PromotionSchemeSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiConflictResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async saveScheme(
    @Body() dto: SavePromotionSchemeDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload>> {
    const data = await this.promotionSchemeService.saveScheme(dto);
    return {
      success: true,
      message: dto.prm_id
        ? 'Promotion scheme updated successfully'
        : 'Promotion scheme created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get one promotion scheme with its branches, parties, items and slabs',
    description: 'Returns the same shape POST /create accepts, ready to edit and post back.',
  })
  @ApiOkResponse({ type: PromotionSchemeSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async getScheme(
    @Query() query: PromotionSchemeIdQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload>> {
    const data = await this.promotionSchemeService.getSchemeById(query.prm_id);
    return { success: true, message: 'Promotion scheme fetched successfully', data };
  }

  @Get('eligibility')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Ask whether one customer qualifies for one scheme',
    description:
      'The read the till needs, as opposed to /get which is the read the grid needs. A customer ' +
      'can be reached by four party rows at once — by name, by their group, by their area and by ' +
      'their city — so the answer names the row that decided it: highest prp_match_priority ' +
      'wins, and at equal priority an EXCLUDE beats an INCLUDE.\n\n' +
      'A scheme whose prm_cust_scope is ALL answers YES without reading a single party row. A ' +
      'scheme scoped to a LIST that no row reaches answers NO.\n\n' +
      'A customer reaches a CITY rule only through their area — cus_area_id is the one path, ' +
      'whatever their free-text city says.',
  })
  @ApiOkResponse({ type: PromotionSchemeEligibilitySuccessDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async checkEligibility(
    @Query() query: PromotionSchemeEligibilityQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeEligibilityPayload>> {
    const data = await this.promotionSchemeService.checkEligibility(query.prm_id, query.cus_id);
    return {
      success: true,
      message: 'Promotion scheme eligibility evaluated successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a promotion scheme and every one of its child rows',
  })
  @ApiOkResponse({ type: PromotionSchemeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async deleteScheme(
    @Query() query: DeletePromotionSchemeQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeDeleteResult>> {
    const data = await this.promotionSchemeService.softDeleteScheme(
      query.prm_id,
      query.prm_modified_by,
    );
    return { success: true, message: 'Promotion scheme deleted successfully', data };
  }
}
