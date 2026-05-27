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
  @ApiOperation({ summary: 'Create or update grid details (by grid_id presence)' })
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

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List grid details with filter/search/pagination' })
  @ApiOkResponse({ type: GridDetailSuccessListDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  async list(
    @Query() queryDto: ListGridDetailQueryDto,
  ): Promise<GridDetailSuccessResponse<GridDetailPayload[], GridDetailListMeta>> {
    const result = await this.gridDetailsService.list(queryDto);

    return {
      success: true,
      message: 'Grid details fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get grid details by id' })
  @ApiQuery({ name: 'grid_id', description: 'Numeric grid id' })
  @ApiOkResponse({ type: GridDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async getById(
    @Query('grid_id') gridId: string,
  ): Promise<GridDetailSuccessResponse<GridDetailPayload>> {
    const data = await this.gridDetailsService.getById(gridId);

    return {
      success: true,
      message: 'Grid details fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete grid details by id' })
  @ApiQuery({ name: 'grid_id', description: 'Numeric grid id' })
  @ApiOkResponse({ type: GridDetailSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async remove(
    @Query('grid_id') gridId: string,
  ): Promise<GridDetailSuccessResponse<{ grid_id: string; deleted: true }>> {
    const data = await this.gridDetailsService.softDelete(gridId);

    return {
      success: true,
      message: 'Grid details deleted successfully',
      data,
    };
  }
}
