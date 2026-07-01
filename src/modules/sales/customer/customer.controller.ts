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
import { CustomerExceptionFilter } from './customer-exception.filter';
import { CustomerService } from './customer.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import {
  CustomerErrorResponseDto,
  CustomerSuccessDeleteDto,
  CustomerSuccessSingleDto,
} from './dto/customer-response.dto';
import {
  CustomerPayload,
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
  constructor(private readonly customerService: CustomerService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update customer (by cusId presence)' })
  @ApiCreatedResponse({ type: CustomerSuccessSingleDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  @ApiConflictResponse({ type: CustomerErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerErrorResponseDto })
  async save(
    @Body() saveCustomerDto: SaveCustomerDto,
  ): Promise<CustomerSuccessResponse<CustomerPayload>> {
    const data = await this.customerService.save(saveCustomerDto);
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
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete customer by id' })
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