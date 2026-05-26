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
import {
  LedgerShippingAddressErrorResponseDto,
  LedgerShippingAddressSuccessDeleteDto,
  LedgerShippingAddressSuccessSingleDto,
} from './dto/ledger-shipping-address-response.dto';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import { LedgerShippingAddressExceptionFilter } from './ledger-shipping-address-exception.filter';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';
import {
  LedgerShippingAddressPayload,
  LedgerShippingAddressSuccessResponse,
} from './types/ledger-shipping-address-api.types';

@ApiTags('Ledger Shipping Address')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('ledger-shipping-addresses')
@UseFilters(LedgerShippingAddressExceptionFilter)
export class LedgerShippingAddressController {
  constructor(private readonly ledgerShippingAddressService: LedgerShippingAddressService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update ledger shipping address (by saaId presence)' })
  @ApiCreatedResponse({ type: LedgerShippingAddressSuccessSingleDto })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiConflictResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerShippingAddressErrorResponseDto })
  async save(
    @Body() saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto,
  ): Promise<LedgerShippingAddressSuccessResponse<LedgerShippingAddressPayload>> {
    const data = await this.ledgerShippingAddressService.save(saveLedgerShippingAddressDto);

    return {
      success: true,
      message: saveLedgerShippingAddressDto.saaId
        ? 'Ledger shipping address updated successfully'
        : 'Ledger shipping address created successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get ledger shipping address by id' })
  @ApiQuery({ name: 'saaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: LedgerShippingAddressSuccessSingleDto })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerShippingAddressErrorResponseDto })
  async getById(
    @Query('saaId', new ParseUUIDPipe({ version: '7' })) saaId: string,
  ): Promise<LedgerShippingAddressSuccessResponse<LedgerShippingAddressPayload>> {
    const data = await this.ledgerShippingAddressService.getById(saaId);

    return {
      success: true,
      message: 'Ledger shipping address fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete ledger shipping address by id' })
  @ApiQuery({ name: 'saaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: LedgerShippingAddressSuccessDeleteDto })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerShippingAddressErrorResponseDto })
  async remove(
    @Query('saaId', new ParseUUIDPipe({ version: '7' })) saaId: string,
  ): Promise<LedgerShippingAddressSuccessResponse<{ saaId: string; deleted: true }>> {
    const data = await this.ledgerShippingAddressService.softDelete(saaId);

    return {
      success: true,
      message: 'Ledger shipping address deleted successfully',
      data,
    };
  }
}
