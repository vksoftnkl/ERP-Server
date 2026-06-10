import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Put, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
  GridDetailSuccessColumnUpdateDto,
  GridDetailSuccessDeleteDto,
  GridDetailSuccessListDto,
  GridDetailSuccessSingleDto,
} from './dto/grid-detail-response.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import { GridDetailExceptionFilter } from './grid-detail-exception.filter';
import { GridDetailsService } from './grid-details.service';
import {
  GridDetailListItem,
  GridDetailPayload,
  GridDetailSuccessResponse,
} from './types/grid-detail-api.types';
import { API_VERSION } from '../../common/constants/api-version';

const gridDetailsCreateExample = {
  grid_id: '17',
  grid_name: 'Item Master Grid',
  grid_description: 'Item master grid configuration',
  grid_sort_column: 'item_name',
  grid_sort_order: 'asc',
  grid_sql: 'SELECT item_id, item_name FROM inventory.item_master',
  grid_status: true,
  grid_device_type: 'desktop',
  grid_columns: [
    {
      grid_serialid: '1',
      grid_column_number: 1,
      grid_column_name: 'Item Name',
      grid_column_width: 180,
      grid_column_position: 1,
      grid_column_alignment: 'left',
      grid_column_visibility: true,
      grid_column_filter: false,
      grid_column_condition: null,
      grid_column_condition_color: null,
      grid_column_group: false,
      grid_column_total: false,
      grid_column_data_type: 'string',
      grid_column_color: null,
      grid_column_notes: null,
      grid_column_sql_field_name: 'item_name',
    },
  ],
};

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
  @ApiOperation({
    summary: 'Create or update grid details with nested columns',
    description:
      'Use this endpoint instead of POST /api/v1/grid-columns/create. Send column rows inside grid_columns.',
  })
  @ApiBody({
    type: SaveGridDetailDto,
    examples: {
      gridDetailsWithColumns: {
        summary: 'Grid details create/update payload',
        value: gridDetailsCreateExample,
      },
    },
  })
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
  @ApiOperation({ summary: 'List grid details with filters' })
  @ApiOkResponse({ type: GridDetailSuccessListDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  async list(
    @Query() queryDto: ListGridDetailQueryDto,
  ): Promise<GridDetailSuccessResponse<GridDetailListItem[]>> {
    const result = await this.gridDetailsService.list(queryDto);
    return {
      success: true,
      message: 'Grid details fetched successfully',
      data: result.items,
    };
  }

  @Put('column-width')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update column width for one or more grid columns' })
  @ApiOkResponse({ type: GridDetailSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async updateColumnWidths(
    @Body() dto: SaveColumnWidthDto,
  ): Promise<GridDetailSuccessResponse<{ updated: number }>> {
    const data = await this.gridDetailsService.updateColumnWidths(dto);
    return { success: true, message: 'Column widths updated successfully', data };
  }

  @Put('filter-settings')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update filter setting for one or more grid columns' })
  @ApiOkResponse({ type: GridDetailSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async updateFilterSettings(
    @Body() dto: SaveFilterSettingsDto,
  ): Promise<GridDetailSuccessResponse<{ updated: number }>> {
    const data = await this.gridDetailsService.updateFilterSettings(dto);
    return { success: true, message: 'Filter settings updated successfully', data };
  }

  @Put('visibility-settings')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update visibility setting for one or more grid columns' })
  @ApiOkResponse({ type: GridDetailSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async updateVisibilitySettings(
    @Body() dto: SaveVisibilitySettingsDto,
  ): Promise<GridDetailSuccessResponse<{ updated: number }>> {
    const data = await this.gridDetailsService.updateVisibilitySettings(dto);
    return { success: true, message: 'Visibility settings updated successfully', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete grid details by id' })
  @ApiQuery({ name: 'grid_id', description: 'Numeric grid id' })
  @ApiOkResponse({ type: GridDetailSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GridDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: GridDetailErrorResponseDto })
  async remove(
    @Query('grid_id') gridId?: string,
  ): Promise<GridDetailSuccessResponse<{ grid_id: string; deleted: true }>> {
    const data = await this.gridDetailsService.softDelete(gridId ?? '');
    return { success: true, message: 'Grid details deleted successfully', data };
  }
}