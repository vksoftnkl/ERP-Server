import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import {
  LedgerShippingAddressErrorResponseDto,
  LedgerShippingAddressSuccessDeleteDto,
  LedgerShippingAddressSuccessListDto,
  LedgerShippingAddressSuccessSingleDto,
} from './dto/ledger-shipping-address-response.dto';
import { ListLedgerShippingAddressQueryDto } from './dto/list-ledger-shipping-address-query.dto';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import { LedgerShippingAddressExceptionFilter } from './ledger-shipping-address-exception.filter';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';
import {
  LedgerShippingAddressListItem,
  LedgerShippingAddressListMeta,
  LedgerShippingAddressPayload,
  LedgerShippingAddressSuccessResponse,
} from './types/ledger-shipping-address-api.types';

@ApiTags('Ledger Shipping Address')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
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

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List ledger shipping addresses with filter/search/pagination' })
  @ApiOkResponse({ type: LedgerShippingAddressSuccessListDto })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  async list(
    @Query() queryDto: ListLedgerShippingAddressQueryDto,
  ): Promise<
    LedgerShippingAddressSuccessResponse<
      LedgerShippingAddressListItem[],
      LedgerShippingAddressListMeta
    >
  > {
    const result = await this.ledgerShippingAddressService.list(queryDto);

    return {
      success: true,
      message: 'Ledger shipping addresses fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:saaId')
  @Version('1')
  @ApiOperation({ summary: 'Get ledger shipping address by id' })
  @ApiParam({ name: 'saaId', format: 'uuid' })
  @ApiOkResponse({ type: LedgerShippingAddressSuccessSingleDto })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerShippingAddressErrorResponseDto })
  async getById(
    @Param('saaId', new ParseUUIDPipe({ version: '7' })) saaId: string,
  ): Promise<LedgerShippingAddressSuccessResponse<LedgerShippingAddressPayload>> {
    const data = await this.ledgerShippingAddressService.getById(saaId);

    return {
      success: true,
      message: 'Ledger shipping address fetched successfully',
      data,
    };
  }

  @Delete('delete/:saaId')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete ledger shipping address by id' })
  @ApiParam({ name: 'saaId', format: 'uuid' })
  @ApiOkResponse({ type: LedgerShippingAddressSuccessDeleteDto })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerShippingAddressErrorResponseDto })
  async remove(
    @Param('saaId', new ParseUUIDPipe({ version: '7' })) saaId: string,
  ): Promise<LedgerShippingAddressSuccessResponse<{ saaId: string; deleted: true }>> {
    const data = await this.ledgerShippingAddressService.softDelete(saaId);

    return {
      success: true,
      message: 'Ledger shipping address deleted successfully',
      data,
    };
  }
}
