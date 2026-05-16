import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListGridColumnQueryDto } from './dto/list-grid-column-query.dto';
import {
  GridColumnErrorResponseDto,
  GridColumnSuccessDeleteDto,
  GridColumnSuccessListDto,
  GridColumnSuccessSingleDto,
} from './dto/grid-column-response.dto';
import { SaveGridColumnDto } from './dto/save-grid-column.dto';
import { GridColumnExceptionFilter } from './grid-column-exception.filter';
import { GridColumnsService } from './grid-columns.service';
import {
  GridColumnListMeta,
  GridColumnPayload,
  GridColumnSuccessResponse,
} from './types/grid-column-api.types';

@ApiTags('Grid Columns')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('grid-columns')
@UseFilters(GridColumnExceptionFilter)
export class GridColumnsController {
  constructor(private readonly gridColumnsService: GridColumnsService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update grid column (by grid_serialid presence)' })
  @ApiCreatedResponse({ type: GridColumnSuccessSingleDto })
  @ApiBadRequestResponse({ type: GridColumnErrorResponseDto })
  @ApiConflictResponse({ type: GridColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: GridColumnErrorResponseDto })
  async save(
    @Body() saveGridColumnDto: SaveGridColumnDto,
  ): Promise<GridColumnSuccessResponse<GridColumnPayload>> {
    const data = await this.gridColumnsService.save(saveGridColumnDto);

    return {
      success: true,
      message: saveGridColumnDto.grid_serialid
        ? 'Grid column updated successfully'
        : 'Grid column created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List grid columns with filter/search/pagination' })
  @ApiOkResponse({ type: GridColumnSuccessListDto })
  @ApiBadRequestResponse({ type: GridColumnErrorResponseDto })
  async list(
    @Query() queryDto: ListGridColumnQueryDto,
  ): Promise<GridColumnSuccessResponse<GridColumnPayload[], GridColumnListMeta>> {
    const result = await this.gridColumnsService.list(queryDto);

    return {
      success: true,
      message: 'Grid columns fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get grid column by id' })
  @ApiQuery({ name: 'grid_serialid', description: 'Numeric grid column id' })
  @ApiOkResponse({ type: GridColumnSuccessSingleDto })
  @ApiBadRequestResponse({ type: GridColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: GridColumnErrorResponseDto })
  async getById(
    @Query('grid_serialid') gridSerialId: string,
  ): Promise<GridColumnSuccessResponse<GridColumnPayload>> {
    const data = await this.gridColumnsService.getById(gridSerialId);

    return {
      success: true,
      message: 'Grid column fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete grid column by id' })
  @ApiQuery({ name: 'grid_serialid', description: 'Numeric grid column id' })
  @ApiOkResponse({ type: GridColumnSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GridColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: GridColumnErrorResponseDto })
  async remove(
    @Query('grid_serialid') gridSerialId: string,
  ): Promise<GridColumnSuccessResponse<{ grid_serialid: string; deleted: true }>> {
    const data = await this.gridColumnsService.softDelete(gridSerialId);

    return {
      success: true,
      message: 'Grid column deleted successfully',
      data,
    };
  }
}
