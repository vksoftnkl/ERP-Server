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
import { CustomerExceptionFilter } from './customer-exception.filter';
import { CustomerService } from './customer.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import {
  CustomerErrorResponseDto,
  CustomerSuccessDeleteDto,
  CustomerSuccessSaveDto,
  CustomerSuccessSingleDto,
} from './dto/customer-response.dto';
import {
  CustomerPayload,
  CustomerSavePayload,
  CustomerSuccessResponse,
} from './types/customer-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Customers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('customers')
@UseFilters(CustomerExceptionFilter)
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly dataChangeService: DataChangeService,
  ) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update customer (by cusId presence)' })
  @ApiCreatedResponse({ type: CustomerSuccessSaveDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiConflictResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async save(
    @Body() saveCustomerDto: SaveCustomerDto,
    @Req() request: { user?: { sid?: string | null } },
  ): Promise<CustomerSuccessResponse<CustomerSavePayload>> {
    const data = await this.customerService.save(saveCustomerDto);
    // D4-8: the supplier row changed too, so open supplier lists re-read (the
    // interceptor already announces `customers`).
    if (data.partySync?.otherRoleUpdated) {
      this.dataChangeService.publish({
        resource: 'suppliers',
        method: 'POST',
        at: Date.now(),
        originSessionId: request.user?.sid ?? null,
      });
    }
    return {
      success: true,
      message: saveCustomerDto.cusId
        ? 'Customer updated successfully'
        : 'Customer created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get customer by id' })
  @ApiQuery({ name: 'cusId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CustomerSuccessSingleDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async getById(
    @Query('cusId', new ParseUUIDPipe({ version: '7' })) cusId: string,
  ): Promise<CustomerSuccessResponse<CustomerPayload>> {
    const data = await this.customerService.getById(cusId);
    return {
      success: true,
      message: 'Customer fetched successfully',
      data,
    };
  }
  @Get('delete-check')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Would DELETE /customers/delete go through? (balance per company, cheques, drafts)',
    description:
      'Party rules D1-4. 200 even when the delete would be refused: canDelete / refusalCode / refusals[] say why. Needs the menu-10 delete right.',
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
    summary: 'Soft delete customer by id',
    description:
      'Menu-10 delete right. 409 CUSTOMER_HAS_BALANCE / CUSTOMER_HAS_CHEQUE_IN_HAND when the ledger goes with the customer and is not settled.',
  })
  @ApiConflictResponse({ type: CustomerErrorResponseDto })
  @ApiForbiddenResponse({ type: CustomerErrorResponseDto })
  @ApiQuery({ name: 'cusId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CustomerSuccessDeleteDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async remove(
    @Query('cusId', new ParseUUIDPipe({ version: '7' })) cusId: string,
  ): Promise<CustomerSuccessResponse<{ cusId: string; deleted: true }>> {
    const data = await this.customerService.softDelete(cusId);
    return {
      success: true,
      message: 'Customer deleted successfully',
      data,
    };
  }
}
