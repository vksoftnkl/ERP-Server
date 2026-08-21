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
  DeletePromotionChildQueryDto,
  DeletePromotionSchemeQueryDto,
  PromotionSchemeIdQueryDto,
} from './dto/promotion-scheme-id-query.dto';
import {
  PromotionSchemeBranchSuccessListDto,
  PromotionSchemeChildSuccessDeleteDto,
  PromotionSchemeErrorResponseDto,
  PromotionSchemeItemSuccessListDto,
  PromotionSchemePartySuccessListDto,
  PromotionSchemeSlabSuccessListDto,
  PromotionSchemeSuccessDeleteDto,
  PromotionSchemeSuccessSingleDto,
} from './dto/promotion-scheme-response.dto';
import { SavePromotionSchemeBranchesDto } from './dto/save-promotion-scheme-branch.dto';
import { SavePromotionSchemeItemsDto } from './dto/save-promotion-scheme-item.dto';
import { SavePromotionSchemePartiesDto } from './dto/save-promotion-scheme-party.dto';
import { SavePromotionSchemeSlabsDto } from './dto/save-promotion-scheme-slab.dto';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import { PromotionSchemeExceptionFilter } from './promotion-scheme-exception.filter';
import { PromotionSchemeService } from './promotion-scheme.service';
import {
  PromotionSchemeBranchPayload,
  PromotionSchemeChildDeleteResult,
  PromotionSchemeDeleteResult,
  PromotionSchemeItemPayload,
  PromotionSchemePartyPayload,
  PromotionSchemePayload,
  PromotionSchemeSlabPayload,
  PromotionSchemeSuccessResponse,
} from './types/promotion-scheme-api.types';

/**
 * One module, five tables.
 *
 * The header (§1) is a PLAIN OBJECT body — one campaign per call. The four
 * scope/band tables (§2 branches, §3 parties, §4 items, §5 slabs) each take an
 * ARRAY under a scheme id, because that is how their grids are edited: a whole
 * page of rows at once, not one HTTP call per line.
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
    summary: 'Create or update a promotion scheme header by prm_id presence',
    description:
      'Object payload. Omit prm_id to create, send it to update — on update only the keys present ' +
      'in the body are written.',
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

  // ─── §2 branches ────────────────────────────────────────────────────────────

  @Post('branches/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Upsert the branch scope rows of a scheme',
    description:
      'Array payload. Rows carrying prb_id are updated, rows without one are inserted, and rows ' +
      'omitted from the array are left untouched — delete explicitly.',
  })
  @ApiCreatedResponse({ type: PromotionSchemeBranchSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiConflictResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async saveBranches(
    @Body() dto: SavePromotionSchemeBranchesDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeBranchPayload[]>> {
    const data = await this.promotionSchemeService.saveBranches(dto);
    return { success: true, message: 'Promotion scheme branches saved successfully', data };
  }

  @Get('branches/get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List the branch scope rows of a scheme' })
  @ApiOkResponse({ type: PromotionSchemeBranchSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async getBranches(
    @Query() query: PromotionSchemeIdQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeBranchPayload[]>> {
    const data = await this.promotionSchemeService.getBranches(query.prm_id);
    return { success: true, message: 'Promotion scheme branches fetched successfully', data };
  }

  @Delete('branches/delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete one branch scope row by prb_id (row_id)' })
  @ApiOkResponse({ type: PromotionSchemeChildSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async deleteBranch(
    @Query() query: DeletePromotionChildQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>> {
    const data = await this.promotionSchemeService.deleteBranch(query.row_id, query.modified_by);
    return { success: true, message: 'Promotion scheme branch deleted successfully', data };
  }

  // ─── §3 parties ─────────────────────────────────────────────────────────────

  @Post('parties/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Upsert the customer/group/area/city scope rows of a scheme',
    description:
      'Array payload. Send prp_kind + prp_scope_id per row; the four FK carrier columns are ' +
      'generated by the database and are not accepted here.',
  })
  @ApiCreatedResponse({ type: PromotionSchemePartySuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiConflictResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async saveParties(
    @Body() dto: SavePromotionSchemePartiesDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemePartyPayload[]>> {
    const data = await this.promotionSchemeService.saveParties(dto);
    return { success: true, message: 'Promotion scheme parties saved successfully', data };
  }

  @Get('parties/get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List the party scope rows of a scheme, narrowest match first' })
  @ApiOkResponse({ type: PromotionSchemePartySuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async getParties(
    @Query() query: PromotionSchemeIdQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemePartyPayload[]>> {
    const data = await this.promotionSchemeService.getParties(query.prm_id);
    return { success: true, message: 'Promotion scheme parties fetched successfully', data };
  }

  @Delete('parties/delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete one party scope row by prp_id (row_id)' })
  @ApiOkResponse({ type: PromotionSchemeChildSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async deleteParty(
    @Query() query: DeletePromotionChildQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>> {
    const data = await this.promotionSchemeService.deleteParty(query.row_id, query.modified_by);
    return { success: true, message: 'Promotion scheme party deleted successfully', data };
  }

  // ─── §4 items ───────────────────────────────────────────────────────────────

  @Post('items/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Upsert the item scope rows of a scheme',
    description:
      'Array payload. Send pri_kind + pri_scope_id per row (plus pri_unit_id when the kind is ' +
      'ITEM); the five FK carrier columns are generated by the database.',
  })
  @ApiCreatedResponse({ type: PromotionSchemeItemSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiConflictResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async saveItems(
    @Body() dto: SavePromotionSchemeItemsDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeItemPayload[]>> {
    const data = await this.promotionSchemeService.saveItems(dto);
    return { success: true, message: 'Promotion scheme items saved successfully', data };
  }

  @Get('items/get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List the item scope rows of a scheme, most specific first' })
  @ApiOkResponse({ type: PromotionSchemeItemSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async getItems(
    @Query() query: PromotionSchemeIdQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeItemPayload[]>> {
    const data = await this.promotionSchemeService.getItems(query.prm_id);
    return { success: true, message: 'Promotion scheme items fetched successfully', data };
  }

  @Delete('items/delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete one item scope row by pri_id (row_id)' })
  @ApiOkResponse({ type: PromotionSchemeChildSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async deleteItem(
    @Query() query: DeletePromotionChildQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>> {
    const data = await this.promotionSchemeService.deleteItem(query.row_id, query.modified_by);
    return { success: true, message: 'Promotion scheme item deleted successfully', data };
  }

  // ─── §5 slabs ───────────────────────────────────────────────────────────────

  @Post('slabs/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Upsert the offer bands of a scheme',
    description:
      "Array payload. prs_benefit defaults to the header's prm_benefit and may not disagree " +
      'with it; the benefit decides which of the band columns must be filled.',
  })
  @ApiCreatedResponse({ type: PromotionSchemeSlabSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiConflictResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async saveSlabs(
    @Body() dto: SavePromotionSchemeSlabsDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeSlabPayload[]>> {
    const data = await this.promotionSchemeService.saveSlabs(dto);
    return { success: true, message: 'Promotion scheme slabs saved successfully', data };
  }

  @Get('slabs/get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List the offer bands of a scheme, lowest threshold first' })
  @ApiOkResponse({ type: PromotionSchemeSlabSuccessListDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async getSlabs(
    @Query() query: PromotionSchemeIdQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeSlabPayload[]>> {
    const data = await this.promotionSchemeService.getSlabs(query.prm_id);
    return { success: true, message: 'Promotion scheme slabs fetched successfully', data };
  }

  @Delete('slabs/delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete one offer band by prs_id (row_id)' })
  @ApiOkResponse({ type: PromotionSchemeChildSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionSchemeErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionSchemeErrorResponseDto })
  async deleteSlab(
    @Query() query: DeletePromotionChildQueryDto,
  ): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>> {
    const data = await this.promotionSchemeService.deleteSlab(query.row_id, query.modified_by);
    return { success: true, message: 'Promotion scheme slab deleted successfully', data };
  }
}
