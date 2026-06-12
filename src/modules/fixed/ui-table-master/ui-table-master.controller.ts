import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Put, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import { SaveUiTableColumnWidthDto } from './dto/save-ui-table-column-width.dto';
import { SaveUiTableVisibilitySettingsDto } from './dto/save-ui-table-visibility-settings.dto';
import {
  UiTableMasterErrorResponseDto,
  UiTableMasterSuccessColumnDeleteDto,
  UiTableMasterSuccessColumnUpdateDto,
  UiTableMasterSuccessDeleteDto,
  UiTableMasterSuccessListDto,
  UiTableMasterSuccessSingleDto,
} from './dto/ui-table-master-response.dto';
import { UiTableMasterExceptionFilter } from './ui-table-master-exception.filter';
import { UiTableMasterService } from './ui-table-master.service';
import {
  UiTableMasterListItem,
  UiTableMasterPayload,
  UiTableMasterSuccessResponse,
} from './types/ui-table-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('UI Table Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('ui-table-masters')
@UseFilters(UiTableMasterExceptionFilter)
export class UiTableMasterController {
  constructor(private readonly uiTableMasterService: UiTableMasterService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update UI table (by uiTblId presence)' })
  @ApiCreatedResponse({ type: UiTableMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiConflictResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async save(
    @Body() saveUiTableMasterDto: SaveUiTableMasterDto,
  ): Promise<UiTableMasterSuccessResponse<UiTableMasterPayload>> {
    const data = await this.uiTableMasterService.save(saveUiTableMasterDto);
    return {
      success: true,
      message: saveUiTableMasterDto.uiTblId
        ? 'UI table updated successfully'
        : 'UI table created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List UI tables with filters' })
  @ApiOkResponse({ type: UiTableMasterSuccessListDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListUiTableMasterQueryDto,
  ): Promise<UiTableMasterSuccessResponse<UiTableMasterListItem[]>> {
    const result = await this.uiTableMasterService.list(queryDto);
    return {
      success: true,
      message: 'UI tables fetched successfully',
      data: result.items,
    };
  }

  @Put('column-width')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update column width for one or more UI table columns' })
  @ApiOkResponse({ type: UiTableMasterSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async updateColumnWidths(
    @Body() dto: SaveUiTableColumnWidthDto,
  ): Promise<UiTableMasterSuccessResponse<{ updated: number }>> {
    const data = await this.uiTableMasterService.updateColumnWidths(dto);
    return { success: true, message: 'Column widths updated successfully', data };
  }

  @Put('visibility-settings')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update visibility setting for one or more UI table columns' })
  @ApiOkResponse({ type: UiTableMasterSuccessColumnUpdateDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async updateVisibilitySettings(
    @Body() dto: SaveUiTableVisibilitySettingsDto,
  ): Promise<UiTableMasterSuccessResponse<{ updated: number }>> {
    const data = await this.uiTableMasterService.updateVisibilitySettings(dto);
    return { success: true, message: 'Visibility settings updated successfully', data };
  }

  @Delete('column-delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a UI table column by id' })
  @ApiQuery({ name: 'uiTblClmId', description: 'Numeric UI table column id' })
  @ApiOkResponse({ type: UiTableMasterSuccessColumnDeleteDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async removeColumn(
    @Query('uiTblClmId') uiTblClmId?: string,
  ): Promise<UiTableMasterSuccessResponse<{ uiTblClmId: string; deleted: true }>> {
    const data = await this.uiTableMasterService.softDeleteColumn(uiTblClmId ?? '');
    return { success: true, message: 'UI table column deleted successfully', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete UI table by id' })
  @ApiQuery({ name: 'uiTblId', description: 'Numeric UI table id' })
  @ApiOkResponse({ type: UiTableMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async remove(
    @Query('uiTblId') uiTblId?: string,
  ): Promise<UiTableMasterSuccessResponse<{ uiTblId: string; deleted: true }>> {
    const data = await this.uiTableMasterService.softDelete(uiTblId ?? '');
    return { success: true, message: 'UI table deleted successfully', data };
  }
}
