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
import { ListUiTableColumnQueryDto } from './dto/list-ui-table-column-query.dto';
import { SaveUiTableColumnDto } from './dto/save-ui-table-column.dto';
import {
  UiTableColumnErrorResponseDto,
  UiTableColumnSuccessDeleteDto,
  UiTableColumnSuccessListDto,
  UiTableColumnSuccessSingleDto,
} from './dto/ui-table-column-response.dto';
import { UiTableColumnExceptionFilter } from './ui-table-column-exception.filter';
import { UiTableColumnsService } from './ui-table-columns.service';
import {
  UiTableColumnListItem,
  UiTableColumnListMeta,
  UiTableColumnPayload,
  UiTableColumnSuccessResponse,
} from './types/ui-table-column-api.types';

@ApiTags('UI Table Columns')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('ui-table-columns')
@UseFilters(UiTableColumnExceptionFilter)
export class UiTableColumnsController {
  constructor(private readonly uiTableColumnsService: UiTableColumnsService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update UI table column (by uiTblClmId presence)' })
  @ApiCreatedResponse({ type: UiTableColumnSuccessSingleDto })
  @ApiBadRequestResponse({ type: UiTableColumnErrorResponseDto })
  @ApiConflictResponse({ type: UiTableColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableColumnErrorResponseDto })
  async save(
    @Body() saveUiTableColumnDto: SaveUiTableColumnDto,
  ): Promise<UiTableColumnSuccessResponse<UiTableColumnPayload>> {
    const data = await this.uiTableColumnsService.save(saveUiTableColumnDto);

    return {
      success: true,
      message: saveUiTableColumnDto.uiTblClmId
        ? 'UI table column updated successfully'
        : 'UI table column created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List UI table columns with filter/search/pagination' })
  @ApiOkResponse({ type: UiTableColumnSuccessListDto })
  @ApiBadRequestResponse({ type: UiTableColumnErrorResponseDto })
  async list(
    @Query() queryDto: ListUiTableColumnQueryDto,
  ): Promise<UiTableColumnSuccessResponse<UiTableColumnListItem[], UiTableColumnListMeta>> {
    const result = await this.uiTableColumnsService.list(queryDto);

    return {
      success: true,
      message: 'UI table columns fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get UI table column by id' })
  @ApiQuery({ name: 'uiTblClmId', description: 'Numeric UI table column id', example: '1' })
  @ApiOkResponse({ type: UiTableColumnSuccessSingleDto })
  @ApiBadRequestResponse({ type: UiTableColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableColumnErrorResponseDto })
  async getById(
    @Query('uiTblClmId') uiTblClmId: string,
  ): Promise<UiTableColumnSuccessResponse<UiTableColumnPayload>> {
    const data = await this.uiTableColumnsService.getById(uiTblClmId);

    return {
      success: true,
      message: 'UI table column fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete UI table column by id' })
  @ApiQuery({ name: 'uiTblClmId', description: 'Numeric UI table column id', example: '1' })
  @ApiOkResponse({ type: UiTableColumnSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UiTableColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: UiTableColumnErrorResponseDto })
  async remove(
    @Query('uiTblClmId') uiTblClmId: string,
  ): Promise<UiTableColumnSuccessResponse<{ uiTblClmId: string; deleted: true }>> {
    const data = await this.uiTableColumnsService.softDelete(uiTblClmId);

    return {
      success: true,
      message: 'UI table column deleted successfully',
      data,
    };
  }
}
