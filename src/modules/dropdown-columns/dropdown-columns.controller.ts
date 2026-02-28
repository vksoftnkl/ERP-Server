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
import { ListDropdownColumnQueryDto } from './dto/list-dropdown-column-query.dto';
import {
  DropdownColumnErrorResponseDto,
  DropdownColumnSuccessDeleteDto,
  DropdownColumnSuccessListDto,
  DropdownColumnSuccessSingleDto,
} from './dto/dropdown-column-response.dto';
import { SaveDropdownColumnDto } from './dto/save-dropdown-column.dto';
import { DropdownColumnExceptionFilter } from './dropdown-column-exception.filter';
import { DropdownColumnsService } from './dropdown-columns.service';
import {
  DropdownColumnListMeta,
  DropdownColumnPayload,
  DropdownColumnSuccessResponse,
} from './types/dropdown-column-api.types';

@ApiTags('Dropdown Columns')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('dropdown-columns')
@UseFilters(DropdownColumnExceptionFilter)
export class DropdownColumnsController {
  constructor(private readonly dropdownColumnsService: DropdownColumnsService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update dropdown column (by drop_columns_serial_id presence)' })
  @ApiCreatedResponse({ type: DropdownColumnSuccessSingleDto })
  @ApiBadRequestResponse({ type: DropdownColumnErrorResponseDto })
  @ApiConflictResponse({ type: DropdownColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownColumnErrorResponseDto })
  async save(
    @Body() saveDropdownColumnDto: SaveDropdownColumnDto,
  ): Promise<DropdownColumnSuccessResponse<DropdownColumnPayload>> {
    const data = await this.dropdownColumnsService.save(saveDropdownColumnDto);

    return {
      success: true,
      message: saveDropdownColumnDto.drop_columns_serial_id
        ? 'Dropdown column updated successfully'
        : 'Dropdown column created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List dropdown columns with filter/search/pagination' })
  @ApiOkResponse({ type: DropdownColumnSuccessListDto })
  @ApiBadRequestResponse({ type: DropdownColumnErrorResponseDto })
  async list(
    @Query() queryDto: ListDropdownColumnQueryDto,
  ): Promise<DropdownColumnSuccessResponse<DropdownColumnPayload[], DropdownColumnListMeta>> {
    const result = await this.dropdownColumnsService.list(queryDto);

    return {
      success: true,
      message: 'Dropdown columns fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get dropdown column by id' })
  @ApiQuery({ name: 'drop_columns_serial_id', description: 'Numeric dropdown column id' })
  @ApiOkResponse({ type: DropdownColumnSuccessSingleDto })
  @ApiBadRequestResponse({ type: DropdownColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownColumnErrorResponseDto })
  async getById(
    @Query('drop_columns_serial_id') dropColumnsSerialId: string,
  ): Promise<DropdownColumnSuccessResponse<DropdownColumnPayload>> {
    const data = await this.dropdownColumnsService.getById(dropColumnsSerialId);

    return {
      success: true,
      message: 'Dropdown column fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Delete dropdown column by id' })
  @ApiQuery({ name: 'drop_columns_serial_id', description: 'Numeric dropdown column id' })
  @ApiOkResponse({ type: DropdownColumnSuccessDeleteDto })
  @ApiBadRequestResponse({ type: DropdownColumnErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownColumnErrorResponseDto })
  async remove(
    @Query('drop_columns_serial_id') dropColumnsSerialId: string,
  ): Promise<DropdownColumnSuccessResponse<{ drop_columns_serial_id: string; deleted: true }>> {
    const data = await this.dropdownColumnsService.delete(dropColumnsSerialId);

    return {
      success: true,
      message: 'Dropdown column deleted successfully',
      data,
    };
  }
}
