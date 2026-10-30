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
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import {
  DeleteLoyaltySchemeQueryDto,
  LoyaltySchemeEligibilityQueryDto,
  LoyaltySchemeIdQueryDto,
} from './dto/loyalty-scheme-id-query.dto';
import {
  LoyaltySchemeEligibilitySuccessDto,
  LoyaltySchemeSuccessDeleteDto,
  LoyaltySchemeSuccessListDto,
  LoyaltySchemeSuccessSingleDto,
  PromotionLoyaltyPointsErrorResponseDto,
} from './dto/promotion-loyalty-points-response.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsExceptionFilter } from './promotion-loyalty-points-exception.filter';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';
import {
  LoyaltySchemeDeleteResult,
  LoyaltySchemeEligibilityPayload,
  LoyaltySchemePayload,
  PromotionLoyaltyPointsSuccessResponse,
} from './types/promotion-loyalty-points-api.types';

/**
 * One module, six tables, one URL.
 *
 * POST /create saves the campaign whole: the header plus the five scope/rate
 * grids (branches, parties, items, slabs, gifts) nested in the same body, in one
 * transaction. GET /get returns the same shape back, names resolved and ready to
 * edit. There is deliberately no per-grid endpoint — a grid row is created,
 * changed and removed by posting the array it belongs to.
 *
 * This replaces the old per-child endpoints (`points/*`, `gifts/*`), which wrote
 * sales.loyalty_sch_points and sales.loyalty_sch_gift. Those tables are gone.
 */
@ApiTags('Promotion Loyalty Points')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('promotion-loyalty-points')
@UseFilters(PromotionLoyaltyPointsExceptionFilter)
export class PromotionLoyaltyPointsController {
  constructor(private readonly promotionLoyaltyPointsService: PromotionLoyaltyPointsService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a whole loyalty scheme — header and all five grids — in one call',
    description:
      'Object payload. Omit lsc_id to create, send it to update — on update only the keys ' +
      'present in the body are written.\n\n' +
      'The `branches`, `parties`, `items`, `slabs` and `gifts` arrays are optional and save ' +
      'with the header in the same transaction. An array that is present REPLACES that grid: ' +
      'rows carrying their own id are updated, rows without one are inserted, and rows already ' +
      'on the scheme but missing from the array are soft deleted. Omit the key to leave the ' +
      'grid untouched — `"slabs": []` means "delete every band", which is not the same thing.',
  })
  @ApiCreatedResponse({ type: LoyaltySchemeSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiConflictResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async saveScheme(
    @Body() dto: SaveLoyaltySchemeDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>> {
    const data = await this.promotionLoyaltyPointsService.saveScheme(dto);
    return {
      success: true,
      message: dto.lsc_id
        ? 'Loyalty scheme updated successfully'
        : 'Loyalty scheme created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get one loyalty scheme with its branches, parties, items, slabs and gifts',
    description: 'Returns the same shape POST /create accepts, ready to edit and post back.',
  })
  @ApiOkResponse({ type: LoyaltySchemeSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async getScheme(
    @Query() query: LoyaltySchemeIdQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>> {
    const data = await this.promotionLoyaltyPointsService.getSchemeById(query.lsc_id);
    return { success: true, message: 'Loyalty scheme fetched successfully', data };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List the live loyalty schemes, optionally narrowed to a company and a branch',
    description:
      'Each scheme comes back WHOLE — the header plus its five grids, the same shape GET /get ' +
      'answers with for one scheme and POST /create accepts back.\n\n' +
      'Only rows with is_deleted = false AND is_active = true are returned, and that is not a ' +
      'parameter. It holds for the child rows too: a deactivated band or party rule is absent ' +
      'from the arrays, not present and flagged.\n\n' +
      'Both `company` and `branch` are OPTIONAL narrowings, applied only when sent. `branch` ' +
      'matches the lsc_branch_id column literally, so company-wide schemes (lsc_branch_id ' +
      'NULL) come back only when no branch is named. Ordered by lsc_code.',
  })
  @ApiOkResponse({ type: LoyaltySchemeSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async listSchemes(
    @Query() query: ListLoyaltySchemeQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload[]>> {
    const data = await this.promotionLoyaltyPointsService.listSchemes(query);
    return { success: true, message: 'Loyalty schemes fetched successfully', data };
  }

  @Get('eligibility')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Ask whether one customer earns on one scheme',
    description:
      'The read the till needs, as opposed to /get which is the read the grid needs. A customer ' +
      'can be reached by two party rows at once — by name and by their group — so the answer ' +
      'names the row that decided it: highest lsp_match_priority wins, and at equal priority an ' +
      'EXCLUDE beats an INCLUDE.\n\n' +
      'A scheme whose lsc_cust_scope is ALL answers YES without reading a single party row. A ' +
      'scheme scoped to a LIST that no row reaches answers NO.',
  })
  @ApiOkResponse({ type: LoyaltySchemeEligibilitySuccessDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async checkEligibility(
    @Query() query: LoyaltySchemeEligibilityQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemeEligibilityPayload>> {
    const data = await this.promotionLoyaltyPointsService.checkEligibility(
      query.lsc_id,
      query.cus_id,
    );
    return {
      success: true,
      message: 'Loyalty scheme eligibility evaluated successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a loyalty scheme and every one of its child rows' })
  @ApiOkResponse({ type: LoyaltySchemeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async deleteScheme(
    @Query() query: DeleteLoyaltySchemeQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemeDeleteResult>> {
    const data = await this.promotionLoyaltyPointsService.softDeleteScheme(
      query.lsc_id,
      query.lsc_modified_by,
    );
    return { success: true, message: 'Loyalty scheme deleted successfully', data };
  }
}
