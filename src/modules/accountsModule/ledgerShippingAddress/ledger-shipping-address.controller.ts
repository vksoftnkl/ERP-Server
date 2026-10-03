import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  DefaultValuePipe,
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
  ApiExtraModels,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import {
  LedgerShippingAddressErrorResponseDto,
  LedgerShippingAddressSuccessDeleteDto,
  LedgerShippingAddressSuccessListDto,
  LedgerShippingAddressSuccessSingleDto,
} from './dto/ledger-shipping-address-response.dto';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import { LedgerShippingAddressExceptionFilter } from './ledger-shipping-address-exception.filter';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';
import {
  LedgerShippingAddressErrorDetail,
  LedgerShippingAddressPayload,
  LedgerShippingAddressSuccessResponse,
} from './types/ledger-shipping-address-api.types';
import { throwAccountsBadRequest } from 'src/common/utils/module-service.utils';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Ledger Shipping Address')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('ledger-shipping-addresses')
@UseFilters(LedgerShippingAddressExceptionFilter)
export class LedgerShippingAddressController {
  constructor(private readonly ledgerShippingAddressService: LedgerShippingAddressService) {}

  @Post('create')
  @Version(API_VERSION)
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

  // Two shapes on one route, the way the account-ledger GET already does it:
  // saaId fetches one address, ledgerId lists every address on that ledger. The
  // list is what a bill-to / ship-to screen actually needs — saaId could only
  // answer for an address whose id the caller already had.
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get ledger shipping address by id, or list every address on one ledger',
    description:
      "Pass saaId to fetch a single address, or ledgerId to list that ledger's addresses " +
      '(default first, then oldest first). Exactly one of the two is required.',
  })
  @ApiQuery({ name: 'saaId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiQuery({ name: 'ledgerId', schema: { type: 'string', format: 'uuid' }, required: false })
  // One route, two response shapes — say so, rather than documenting only the one
  // a caller passing ledgerId will never see.
  @ApiExtraModels(LedgerShippingAddressSuccessSingleDto, LedgerShippingAddressSuccessListDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LedgerShippingAddressSuccessSingleDto) },
        { $ref: getSchemaPath(LedgerShippingAddressSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: LedgerShippingAddressErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerShippingAddressErrorResponseDto })
  async getById(
    @Query(
      'saaId',
      new DefaultValuePipe(undefined),
      new ParseUUIDPipe({ version: '7', optional: true }),
    )
    saaId: string | undefined,
    @Query(
      'ledgerId',
      new DefaultValuePipe(undefined),
      new ParseUUIDPipe({ version: '7', optional: true }),
    )
    ledgerId: string | undefined,
  ): Promise<
    LedgerShippingAddressSuccessResponse<
      LedgerShippingAddressPayload | { data: LedgerShippingAddressPayload[]; total: number }
    >
  > {
    if (saaId) {
      const data = await this.ledgerShippingAddressService.getById(saaId);

      return {
        success: true,
        message: 'Ledger shipping address fetched successfully',
        data,
      };
    }

    if (!ledgerId) {
      throwAccountsBadRequest<LedgerShippingAddressErrorDetail>(
        'Either saaId or ledgerId is required',
        [
          {
            field: 'ledgerId',
            message: "Pass saaId to fetch one address, or ledgerId to list a ledger's addresses",
          },
        ],
      );
    }

    const data = await this.ledgerShippingAddressService.listByLedger(ledgerId);

    return {
      success: true,
      message: 'Ledger shipping addresses fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
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
