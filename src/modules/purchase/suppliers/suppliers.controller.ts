import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
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
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { DataChangeService } from '../../../common/data-changes/data-change.service';
import { PartyDeleteCheckSuccessDto } from '../../../common/party/party-response.dto';
import type { PartyDeleteCheck } from '../../../common/party/party-balance.service';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import {
  SupplierErrorResponseDto,
  SupplierSuccessDeleteDto,
  SupplierSuccessSaveDto,
  SupplierSuccessSingleDto,
} from './dto/supplier-response.dto';
import { SupplierExceptionFilter } from './supplier-exception.filter';
import { SuppliersService } from './suppliers.service';
import {
  SupplierPayload,
  SupplierSavePayload,
  SupplierSuccessResponse,
} from './types/supplier-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('suppliers')
@UseFilters(SupplierExceptionFilter)
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly dataChangeService: DataChangeService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update supplier (by supId presence)' })
  @ApiCreatedResponse({ type: SupplierSuccessSaveDto })
  @ApiBadRequestResponse({ type: SupplierErrorResponseDto })
  @ApiConflictResponse({ type: SupplierErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierErrorResponseDto })
  async save(
    @Body() saveSupplierDto: SaveSupplierDto,
    @Req() request: { user?: { sid?: string | null } },
  ): Promise<SupplierSuccessResponse<SupplierSavePayload>> {
    const data = await this.suppliersService.save(saveSupplierDto);
    // D4-8: the customer row changed too, so open customer lists re-read.
    if (data.partySync?.otherRoleUpdated) {
      this.dataChangeService.publish({
        resource: 'customers',
        method: 'POST',
        at: Date.now(),
        originSessionId: request.user?.sid ?? null,
      });
    }

    return {
      success: true,
      message: saveSupplierDto.supId
        ? 'Supplier updated successfully'
        : 'Supplier created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
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

  @Get('delete-check')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Would DELETE /suppliers/delete go through? (balance per company, cheques, drafts)',
    description:
      'Party rules D1-4. 200 even when the delete would be refused: canDelete / refusalCode / refusals[] say why. Needs the menu-22 delete right.',
  })
  @ApiQuery({ name: 'supId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: PartyDeleteCheckSuccessDto })
  @ApiForbiddenResponse({ type: SupplierErrorResponseDto })
  @ApiNotFoundResponse({ type: SupplierErrorResponseDto })
  async deleteCheck(
    @Query('supId', new ParseUUIDPipe({ version: '7' })) supId: string,
  ): Promise<SupplierSuccessResponse<PartyDeleteCheck>> {
    const data = await this.suppliersService.deleteCheck(supId);
    return { success: true, message: 'Supplier delete check', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete supplier by id',
    description:
      'Menu-22 delete right. 409 PURCHASE_SUPPLIER_HAS_BALANCE / _HAS_CHEQUE_IN_HAND when the ledger goes with the supplier and is not settled.',
  })
  @ApiConflictResponse({ type: SupplierErrorResponseDto })
  @ApiForbiddenResponse({ type: SupplierErrorResponseDto })
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
