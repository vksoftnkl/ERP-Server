import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
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
import { ListDropdownDetailQueryDto } from './dto/list-dropdown-detail-query.dto';
import {
  DropdownDetailErrorResponseDto,
  DropdownDetailSuccessColumnDeleteDto,
  DropdownDetailSuccessColumnUpdateDto,
  DropdownDetailSuccessDeleteDto,
  DropdownDetailSuccessListDto,
  DropdownDetailSuccessSingleDto,
} from './dto/dropdown-detail-response.dto';
import { SaveDropdownDetailDto } from './dto/save-dropdown-detail.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import { DropdownDetailExceptionFilter } from './dropdown-detail-exception.filter';
import { DropdownDetailsService } from './dropdown-details.service';
import {
  DropdownDetailListItem,
  DropdownDetailPayload,
  DropdownDetailSuccessResponse,
} from './types/dropdown-detail-api.types';
import { API_VERSION } from '../../common/constants/api-version';
const dropdownDetailsCreateExample = {
  dropdown_id: '1',
  dropdown_name: 'Item Master Dropdown',
  dropdown_description: 'Item master dropdown configuration',
  dropdown_sql: 'SELECT item_id, item_name FROM inventory.item_master',
  dropdown_sort_order: 'asc',
  dropdown_sort_column: 'item_name',
  dropdown_max_visible_items: 10,
  dropdown_show_header: true,
  dropdown_width: 300,
  dropdown_columns: [
    {
      drop_columns_id: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001',
      drop_columns_column_no: 1,
      drop_columns_data_type: 'string',
      drop_columns_column_name: 'item_name',
      drop_columns_column_alias: 'Item Name',
      drop_columns_column_width: 180,
      drop_columns_column_visiblity: true,
      drop_columns_column_allignment: 'left',
      drop_columns_column_filter: false,
    },
  ],
};
@ApiTags('Dropdown Details')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('dropdown-details')
@UseFilters(DropdownDetailExceptionFilter)
export class DropdownDetailsController {
  constructor(private readonly dropdownDetailsService: DropdownDetailsService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update dropdown details with nested columns',
    description:
      'Use this endpoint instead of POST /api/v1/dropdown-columns/create. Send column rows inside dropdown_columns.',
  })
  @ApiBody({
    type: SaveDropdownDetailDto,
    examples: {
      dropdownDetailsWithColumns: {
        summary: 'Dropdown details create/update payload',
        value: dropdownDetailsCreateExample,
      },
    },
  })
  @ApiCreatedResponse({ type: DropdownDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async save(
    @Body() saveDropdownDetailDto: SaveDropdownDetailDto,
  ): Promise<DropdownDetailSuccessResponse<DropdownDetailPayload>> {
    const data = await this.dropdownDetailsService.save(saveDropdownDetailDto);
    return {
      success: true,
      message: saveDropdownDetailDto.dropdown_id
        ? 'Dropdown details updated successfully'
        : 'Dropdown details created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List dropdown details with filters' })
  @ApiOkResponse({ type: DropdownDetailSuccessListDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  async list(
    @Query() queryDto: ListDropdownDetailQueryDto,
  ): Promise<DropdownDetailSuccessResponse<DropdownDetailListItem[]>> {
    const result = await this.dropdownDetailsService.list(queryDto);
    return {
      success: true,
      message: 'Dropdown details fetched successfully',
      data: result.items,
    };
  }
  @Put('column-width')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update column width for one or more dropdown columns' })
  @ApiOkResponse({ type: DropdownDetailSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async updateColumnWidths(
    @Body() dto: SaveColumnWidthDto,
  ): Promise<DropdownDetailSuccessResponse<{ updated: number }>> {
    const data = await this.dropdownDetailsService.updateColumnWidths(dto);
    return { success: true, message: 'Column widths updated successfully', data };
  }
  @Put('filter-settings')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update filter setting for one or more dropdown columns' })
  @ApiOkResponse({ type: DropdownDetailSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async updateFilterSettings(
    @Body() dto: SaveFilterSettingsDto,
  ): Promise<DropdownDetailSuccessResponse<{ updated: number }>> {
    const data = await this.dropdownDetailsService.updateFilterSettings(dto);
    return { success: true, message: 'Filter settings updated successfully', data };
  }
  @Put('visibility-settings')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update visibility setting for one or more dropdown columns' })
  @ApiOkResponse({ type: DropdownDetailSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async updateVisibilitySettings(
    @Body() dto: SaveVisibilitySettingsDto,
  ): Promise<DropdownDetailSuccessResponse<{ updated: number }>> {
    const data = await this.dropdownDetailsService.updateVisibilitySettings(dto);
    return { success: true, message: 'Visibility settings updated successfully', data };
  }
  @Delete('column-delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Delete a dropdown column by id' })
  @ApiQuery({ name: 'drop_columns_id', description: 'UUID dropdown column id' })
  @ApiOkResponse({ type: DropdownDetailSuccessColumnDeleteDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async removeColumn(
    @Query('drop_columns_id') dropColumnsId?: string,
  ): Promise<DropdownDetailSuccessResponse<{ drop_columns_id: string; deleted: true }>> {
    const data = await this.dropdownDetailsService.deleteColumn(dropColumnsId ?? '');
    return { success: true, message: 'Dropdown column deleted successfully', data };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Delete dropdown details by id' })
  @ApiQuery({ name: 'dropdown_id', description: 'Numeric dropdown id' })
  @ApiOkResponse({ type: DropdownDetailSuccessDeleteDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async remove(
    @Query('dropdown_id') dropdownId?: string,
  ): Promise<DropdownDetailSuccessResponse<{ dropdown_id: string; deleted: true }>> {
    const data = await this.dropdownDetailsService.delete(dropdownId ?? '');
    return { success: true, message: 'Dropdown details deleted successfully', data };
  }
}
