import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListGridDetailQueryDto } from './dto/list-grid-detail-query.dto';
import {
  GridDetailErrorResponseDto,
  GridDetailSuccessDeleteDto,
  GridDetailSuccessListDto,
  GridDetailSuccessSingleDto,
} from './dto/grid-detail-response.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import { GridDetailExceptionFilter } from './grid-detail-exception.filter';
import { GridDetailsService } from './grid-details.service';
import {
  GridDetailListItem,
  GridDetailListMeta,
  GridDetailPayload,
  GridDetailSuccessResponse,
} from './types/grid-detail-api.types';
import { API_VERSION } from '../../common/constants/api-version';
@ApiTags('Grid Details')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('grid-details')
@UseFilters(GridDetailExceptionFilter)
export class GridDetailsController {
  constructor(private readonly gridDetailsService: GridDetailsService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update grid details with columns (by grid_id presence)' })
  @ApiCreatedResponse({ type: GridDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async save(
    @Body() saveGridDetailDto: SaveGridDetailDto,
  ): Promise<GridDetailSuccessResponse<GridDetailPayload>> {
    const data = await this.gridDetailsService.save(saveGridDetailDto);
    return {
      success: true,
      message: saveGridDetailDto.grid_id
        ? 'Grid details updated successfully'
        : 'Grid details created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List grid details with filter/search/pagination' })
  @ApiOkResponse({ type: GridDetailSuccessListDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  async list(
    @Query() queryDto: ListGridDetailQueryDto,
  ): Promise<GridDetailSuccessResponse<GridDetailListItem[], GridDetailListMeta>> {
    const result = await this.gridDetailsService.list(queryDto);
    return {
      success: true,
      message: 'Grid details fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
}