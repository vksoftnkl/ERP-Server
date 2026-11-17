import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Put,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { DataChangeService } from '../../common/data-changes/data-change.service';
import { PartyDeleteCheckSuccessDto } from '../../common/party/party-response.dto';
import type { PartyDeleteCheck } from '../../common/party/party-balance.service';
import { CustomerExceptionFilter } from '../../modules/sales/customer/customer-exception.filter';
import { CustomerService } from '../../modules/sales/customer/customer.service';
import {
  CustomerErrorResponseDto,
  CustomerSuccessDeleteDto,
  CustomerSuccessSaveDto,
} from '../../modules/sales/customer/dto/customer-response.dto';
import type {
  CustomerSavePayload,
  CustomerSuccessResponse,
} from '../../modules/sales/customer/types/customer-api.types';
import {
  CreateMobileCustomerDto,
  ListMobileCustomersQueryDto,
  UpdateMobileCustomerDto,
} from './dto/mobile-customer.dto';
import {
  MobileCustomerDetailSuccessDto,
  MobileCustomerFormOptionsSuccessDto,
  MobileCustomerListSuccessDto,
} from './dto/mobile-customer-response.dto';
import { MobileCustomerService } from './mobile-customer.service';
import type {
  MobileCustomerDetail,
  MobileCustomerFormOptions,
  MobileCustomerListPayload,
} from './types/mobile-customer-api.types';

type SessionRequest = { user?: { sid?: string | null } };

/**
 * Customer master for the React Native app. Reads are shaped for the phone
 * (one paged list with balances, one options call for the form); every write
 * goes through the desktop CustomerService, so a customer saved here is the
 * same as one saved on the desktop: linked ledger, party rules, audit, the
 * menu-10 delete right and the same error codes (CUSTOMER_*).
 *
 * No @CacheTTL: the list carries balances and the login company's figures,
 * and the HTTP cache key holds neither the user nor the company.
 *
 * @OptionalAuth (user's call, 2026-11-16): no token needed. A token that is
 * sent is still checked (bad one = 401) and read. Without one there is no
 * user and no company: balances are null, delete / delete-check answer 403
 * (the menu-10 right needs a user), and audit rows name the default actor.
 */
@ApiTags('Mobile · Customers')
@OptionalAuth()
// Swagger: the bearer is optional (`{}` = no auth is also accepted).
@ApiBearerAuth('access-token')
@ApiSecurity({})
@ApiUnauthorizedResponse({
  type: HttpErrorResponseDto,
  description: 'Only when a token is sent and it is malformed, expired or revoked',
})
@Controller('mobile/customers')
@UseFilters(CustomerExceptionFilter)
export class MobileCustomerController {
  constructor(
    private readonly mobileCustomerService: MobileCustomerService,
    private readonly customerService: CustomerService,
    private readonly dataChangeService: DataChangeService,
  ) {}

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Paged customer list with search, filter chips and balances',
    description:
      'Sorted by name. Balance = closing today in the login company (this year opening set + ' +
      'posted legs, all branches), the Ledger Statement figure; null without a token. counts apply the search, not the filter.',
  })
  @ApiOkResponse({ type: MobileCustomerListSuccessDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  async list(
    @Query() query: ListMobileCustomersQueryDto,
  ): Promise<CustomerSuccessResponse<MobileCustomerListPayload>> {
    const data = await this.mobileCustomerService.list(query);
    return { success: true, message: 'Customers fetched successfully', data };
  }

  @Get('options')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Pick lists for the entry form: areas, groups, price levels, states, GST types',
  })
  @ApiOkResponse({ type: MobileCustomerFormOptionsSuccessDto })
  async options(): Promise<CustomerSuccessResponse<MobileCustomerFormOptions>> {
    const data = await this.mobileCustomerService.formOptions();
    return { success: true, message: 'Customer form options fetched successfully', data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One customer, with related names and its balance' })
  @ApiQuery({ name: 'cusId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: MobileCustomerDetailSuccessDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async getById(
    @Query('cusId', new ParseUUIDPipe({ version: '7' })) cusId: string,
  ): Promise<CustomerSuccessResponse<MobileCustomerDetail>> {
    const data = await this.mobileCustomerService.getById(cusId);
    return { success: true, message: 'Customer fetched successfully', data };
  }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create a customer (and its linked ledger)',
    description:
      'The desktop /customers/create payload without cusId (sending one is a 400 ' +
      'VALIDATION_WHITELIST). cusLinkLedId makes an existing party ledger a customer.',
  })
  @ApiCreatedResponse({ type: CustomerSuccessSaveDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiConflictResponse({ type: CustomerErrorResponseDto })
  async create(
    @Body() dto: CreateMobileCustomerDto,
    @Req() request: SessionRequest,
  ): Promise<CustomerSuccessResponse<CustomerSavePayload>> {
    const data = await this.customerService.save(dto);
    this.announceOtherRole(data, request);
    return { success: true, message: 'Customer created successfully', data };
  }

  @Put('update')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Update a customer (and its linked ledger)',
    description: 'The full desktop save payload with cusId required; cusLinkLedId is create-only.',
  })
  @ApiOkResponse({ type: CustomerSuccessSaveDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiConflictResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async update(
    @Body() dto: UpdateMobileCustomerDto,
    @Req() request: SessionRequest,
  ): Promise<CustomerSuccessResponse<CustomerSavePayload>> {
    const data = await this.customerService.save(dto);
    this.announceOtherRole(data, request);
    return { success: true, message: 'Customer updated successfully', data };
  }

  @Get('delete-check')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Would DELETE /mobile/customers/delete go through?',
    description:
      'Party rules D1-4. 200 even when refused: canDelete / refusalCode / refusals[] say why. Needs a token whose user holds the menu-10 delete right (no token = 403).',
  })
  @ApiQuery({ name: 'cusId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: PartyDeleteCheckSuccessDto })
  @ApiForbiddenResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async deleteCheck(
    @Query('cusId', new ParseUUIDPipe({ version: '7' })) cusId: string,
  ): Promise<CustomerSuccessResponse<PartyDeleteCheck>> {
    const data = await this.customerService.deleteCheck(cusId);
    return { success: true, message: 'Customer delete check', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a customer',
    description:
      'Needs a token whose user holds the menu-10 delete right (no token = 403). 409 CUSTOMER_HAS_BALANCE / CUSTOMER_HAS_CHEQUE_IN_HAND when the ledger goes with the customer and is not settled.',
  })
  @ApiQuery({ name: 'cusId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CustomerSuccessDeleteDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiConflictResponse({ type: CustomerErrorResponseDto })
  @ApiForbiddenResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async remove(
    @Query('cusId', new ParseUUIDPipe({ version: '7' })) cusId: string,
  ): Promise<CustomerSuccessResponse<{ cusId: string; deleted: true }>> {
    const data = await this.customerService.softDelete(cusId);
    return { success: true, message: 'Customer deleted successfully', data };
  }

  /**
   * Party rules D4-8: the save touched the supplier of the same ledger, so open
   * supplier lists re-read. (The write interceptor announces `customers`.)
   */
  private announceOtherRole(data: CustomerSavePayload, request: SessionRequest): void {
    if (data.partySync?.otherRoleUpdated) {
      this.dataChangeService.publish({
        resource: 'suppliers',
        method: 'POST',
        at: Date.now(),
        originSessionId: request.user?.sid ?? null,
      });
    }
  }
}
