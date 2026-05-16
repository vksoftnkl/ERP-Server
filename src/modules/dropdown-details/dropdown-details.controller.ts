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
import { ListDropdownDetailQueryDto } from './dto/list-dropdown-detail-query.dto';
import {
  DropdownDetailErrorResponseDto,
  DropdownDetailSuccessDeleteDto,
  DropdownDetailSuccessListDto,
  DropdownDetailSuccessSingleDto,
} from './dto/dropdown-detail-response.dto';
import { SaveDropdownDetailDto } from './dto/save-dropdown-detail.dto';
import { DropdownDetailExceptionFilter } from './dropdown-detail-exception.filter';
import { DropdownDetailsService } from './dropdown-details.service';
import {
  DropdownDetailListMeta,
  DropdownDetailPayload,
  DropdownDetailSuccessResponse,
} from './types/dropdown-detail-api.types';
@ApiTags('Dropdown Details')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('dropdown-details')
@UseFilters(DropdownDetailExceptionFilter)
export class DropdownDetailsController {
  constructor(private readonly dropdownDetailsService: DropdownDetailsService) {}
  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update dropdown details (by dropdown_id presence)' })
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
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List dropdown details with filter/search/pagination' })
  @ApiOkResponse({ type: DropdownDetailSuccessListDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  async list(
    @Query() queryDto: ListDropdownDetailQueryDto,
  ): Promise<DropdownDetailSuccessResponse<DropdownDetailPayload[], DropdownDetailListMeta>> {
    const result = await this.dropdownDetailsService.list(queryDto);
    return {
      success: true,
      message: 'Dropdown details fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get dropdown details by id' })
  @ApiQuery({ name: 'dropdown_id', description: 'Numeric dropdown id' })
  @ApiOkResponse({ type: DropdownDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async getById(
    @Query('dropdown_id') dropdownId: string,
  ): Promise<DropdownDetailSuccessResponse<DropdownDetailPayload>> {
    const data = await this.dropdownDetailsService.getById(dropdownId);
    return {
      success: true,
      message: 'Dropdown details fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Delete dropdown details by id' })
  @ApiQuery({ name: 'dropdown_id', description: 'Numeric dropdown id' })
  @ApiOkResponse({ type: DropdownDetailSuccessDeleteDto })
  @ApiBadRequestResponse({ type: DropdownDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: DropdownDetailErrorResponseDto })
  async remove(
    @Query('dropdown_id') dropdownId: string,
  ): Promise<DropdownDetailSuccessResponse<{ dropdown_id: string; deleted: true }>> {
    const data = await this.dropdownDetailsService.delete(dropdownId);
    return {
      success: true,
      message: 'Dropdown details deleted successfully',
      data,
    };
  }
}
