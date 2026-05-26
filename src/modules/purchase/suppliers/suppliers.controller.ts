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
import { SaveSupplierDto } from './dto/save-supplier.dto';
import {
  SupplierErrorResponseDto,
  SupplierSuccessDeleteDto,
  SupplierSuccessSingleDto,
} from './dto/supplier-response.dto';
import { SupplierExceptionFilter } from './supplier-exception.filter';
import { SuppliersService } from './suppliers.service';
import {
  SupplierPayload,
  SupplierSuccessResponse,
} from './types/supplier-api.types';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('suppliers')
@UseFilters(SupplierExceptionFilter)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update supplier (by supId presence)' })
  @ApiCreatedResponse({ type: SupplierSuccessSingleDto })
  @ApiBadRequestResponse({ type: SupplierErrorResponseDto })
  @ApiConflictResponse({ type: SupplierErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierErrorResponseDto })
  async save(
    @Body() saveSupplierDto: SaveSupplierDto,
  ): Promise<SupplierSuccessResponse<SupplierPayload>> {
    const data = await this.suppliersService.save(saveSupplierDto);

    return {
      success: true,
      message: saveSupplierDto.supId
        ? 'Supplier updated successfully'
        : 'Supplier created successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get supplier by id' })
  @ApiQuery({ name: 'supId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SupplierSuccessSingleDto })
  @ApiBadRequestResponse({ type: SupplierErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierErrorResponseDto })
  async getById(
    @Query('supId', new ParseUUIDPipe({ version: '7' })) supId: string,
  ): Promise<SupplierSuccessResponse<SupplierPayload>> {
    const data = await this.suppliersService.getById(supId);

    return {
      success: true,
      message: 'Supplier fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete supplier by id' })
  @ApiQuery({ name: 'supId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SupplierSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SupplierErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierErrorResponseDto })
  async remove(
    @Query('supId', new ParseUUIDPipe({ version: '7' })) supId: string,
  ): Promise<SupplierSuccessResponse<{ supId: string; deleted: true }>> {
    const data = await this.suppliersService.softDelete(supId);

    return {
      success: true,
      message: 'Supplier deleted successfully',
      data,
    };
  }
}
