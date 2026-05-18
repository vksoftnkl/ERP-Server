import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
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
import { ListSupplierGroupQueryDto } from './dto/list-supplier-group-query.dto';
import { SaveSupplierGroupDto } from './dto/save-supplier-group.dto';
import {
  SupplierGroupErrorResponseDto,
  SupplierGroupSuccessDeleteDto,
  SupplierGroupSuccessListDto,
  SupplierGroupSuccessSingleDto,
} from './dto/supplier-group-response.dto';
import { SupplierGroupExceptionFilter } from './supplier-group-exception.filter';
import { SupplierGroupService } from './supplier-group.service';
import {
  SupplierGroupListItem,
  SupplierGroupListMeta,
  SupplierGroupPayload,
  SupplierGroupSuccessResponse,
} from './types/supplier-group-api.types';
@ApiTags('Supplier Groups')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('supplier-groups')
@UseFilters(SupplierGroupExceptionFilter)
export class SupplierGroupController {
  constructor(private readonly supplierGroupService: SupplierGroupService) {}
  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update supplier group (by spgId presence)' })
  @ApiCreatedResponse({ type: SupplierGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: SupplierGroupErrorResponseDto })
  @ApiConflictResponse({ type: SupplierGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierGroupErrorResponseDto })
  async save(
    @Body() saveSupplierGroupDto: SaveSupplierGroupDto,
  ): Promise<SupplierGroupSuccessResponse<SupplierGroupPayload>> {
    const data = await this.supplierGroupService.save(saveSupplierGroupDto);
    return {
      success: true,
      message: saveSupplierGroupDto.spgId
        ? 'Supplier group updated successfully'
        : 'Supplier group created successfully',
      data,
    };
  }
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List supplier groups with filter/search/pagination' })
  @ApiOkResponse({ type: SupplierGroupSuccessListDto })
  @ApiBadRequestResponse({ type: SupplierGroupErrorResponseDto })
  async list(
    @Query() queryDto: ListSupplierGroupQueryDto,
  ): Promise<SupplierGroupSuccessResponse<SupplierGroupListItem[], SupplierGroupListMeta>> {
    const result = await this.supplierGroupService.list(queryDto);
    return {
      success: true,
      message: 'Supplier groups fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get supplier group by id' })
  @ApiQuery({ name: 'spgId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SupplierGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: SupplierGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierGroupErrorResponseDto })
  async getById(
    @Query('spgId', new ParseUUIDPipe({ version: '7' })) spgId: string,
  ): Promise<SupplierGroupSuccessResponse<SupplierGroupPayload>> {
    const data = await this.supplierGroupService.getById(spgId);
    return {
      success: true,
      message: 'Supplier group fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete supplier group by id' })
  @ApiQuery({ name: 'spgId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SupplierGroupSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SupplierGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierGroupErrorResponseDto })
  async remove(
    @Query('spgId', new ParseUUIDPipe({ version: '7' })) spgId: string,
  ): Promise<SupplierGroupSuccessResponse<{ spgId: string; deleted: true }>> {
    const data = await this.supplierGroupService.softDelete(spgId);
    return {
      success: true,
      message: 'Supplier group deleted successfully',
      data,
    };
  }
}
