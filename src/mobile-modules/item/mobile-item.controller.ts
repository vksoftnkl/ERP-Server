import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { ListMobileItemsQueryDto } from './dto/mobile-item.dto';
import {
  MobileItemListSuccessDto,
  MobileItemOptionsSuccessDto,
} from './dto/mobile-item-response.dto';
import { MobileItemService } from './mobile-item.service';
import type { MobileItemListPayload, MobileItemOptions } from './types/mobile-item-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

/**
 * Items for the React Native order screen. Read-only, no database change.
 *
 * No @CacheTTL: the list carries company stock and branch prices, and the
 * HTTP cache key holds neither (redis usage audit). @OptionalAuth, like
 * /mobile/customers: no token needed; a sent token is still checked.
 */
@ApiTags('Mobile · Items')
@OptionalAuth()
@ApiBearerAuth('access-token')
@ApiSecurity({})
@ApiUnauthorizedResponse({
  type: HttpErrorResponseDto,
  description: 'Only when a token is sent and it is malformed, expired or revoked',
})
@Controller('mobile/items')
@UseFilters(MobileExceptionFilter)
export class MobileItemController {
  constructor(private readonly mobileItemService: MobileItemService) {}

  @Get('options')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Pick lists for the order screen: companies, their branches, item groups, brands, price levels',
    description:
      'Active, live rows only. branches = the active branches of the listed companies, per ' +
      'company in that order, then by name (for the phone, which reaches only /mobile/* over ' +
      'plain HTTP). Price levels leave out Cost (7): the phone carries no cost price.',
  })
  @ApiOkResponse({ type: MobileItemOptionsSuccessDto })
  async options(): Promise<MobileSuccess<MobileItemOptions>> {
    const data = await this.mobileItemService.options();
    return { success: true, message: 'Item options fetched successfully', data };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Paged list of the items orderable for a company, with units, prices and stock',
    description:
      "Items that are live, active, item_allow_so, and shared or the company's own, sorted by " +
      'English name. Per unit: the iucId (soiItemUnitId), factor, default flag, weight, the ' +
      'prices of levels 1-4, MRP, minimum, loading and freight charge, picked as ' +
      '/master-lookups/item-price picks them for a line with no MRP (the headline row, branch ' +
      'before chain; an item priced only per MRP takes its dearest bucket), and the free ' +
      'saleable stock in the company (stock.stock_balance). No cost price.',
  })
  @ApiOkResponse({ type: MobileItemListSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'deviceUid sent but not registered, blocked or inactive (MOBILE_DEVICE_*)',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  async list(
    @Query() query: ListMobileItemsQueryDto,
  ): Promise<MobileSuccess<MobileItemListPayload>> {
    const data = await this.mobileItemService.list(query);
    return { success: true, message: 'Items fetched successfully', data };
  }
}
