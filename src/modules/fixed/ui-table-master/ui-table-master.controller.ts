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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import {
  UiTableMasterErrorResponseDto,
  UiTableMasterSuccessDeleteDto,
  UiTableMasterSuccessListDto,
  UiTableMasterSuccessSingleDto,
} from './dto/ui-table-master-response.dto';
import { UiTableMasterExceptionFilter } from './ui-table-master-exception.filter';
import { UiTableMasterService } from './ui-table-master.service';
import {
  UiTableMasterListItem,
  UiTableMasterListMeta,
  UiTableMasterPayload,
  UiTableMasterSuccessResponse,
} from './types/ui-table-master-api.types';

@ApiTags('UI Table Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(3600)
@Controller('ui-table-masters')
@UseFilters(UiTableMasterExceptionFilter)
export class UiTableMasterController {
  constructor(private readonly uiTableMasterService: UiTableMasterService) {}

  @Post('create')
  @Version('1')
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

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List UI tables with filter/search/pagination' })
  @ApiOkResponse({ type: UiTableMasterSuccessListDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListUiTableMasterQueryDto,
  ): Promise<UiTableMasterSuccessResponse<UiTableMasterListItem[], UiTableMasterListMeta>> {
    const result = await this.uiTableMasterService.list(queryDto);

    return {
      success: true,
      message: 'UI tables fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get UI table by id' })
  @ApiQuery({ name: 'uiTblId', description: 'Numeric UI table id', example: '1' })
  @ApiOkResponse({ type: UiTableMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async getById(
    @Query('uiTblId') uiTblId: string,
  ): Promise<UiTableMasterSuccessResponse<UiTableMasterPayload>> {
    const data = await this.uiTableMasterService.getById(uiTblId);

    return {
      success: true,
      message: 'UI table fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete UI table by id' })
  @ApiQuery({ name: 'uiTblId', description: 'Numeric UI table id', example: '1' })
  @ApiOkResponse({ type: UiTableMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UiTableMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableMasterErrorResponseDto })
  async remove(
    @Query('uiTblId') uiTblId: string,
  ): Promise<UiTableMasterSuccessResponse<{ uiTblId: string; deleted: true }>> {
    const data = await this.uiTableMasterService.softDelete(uiTblId);

    return {
      success: true,
      message: 'UI table deleted successfully',
      data,
    };
  }
}
