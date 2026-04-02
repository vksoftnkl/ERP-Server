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
import { ListCustomerQueryDto } from './dto/list-customer-query.dto';
import { SaveCustomerDto } from './dto/save-customer.dto';
import {
  CustomerErrorResponseDto,
  CustomerSuccessDeleteDto,
  CustomerSuccessListDto,
  CustomerSuccessSingleDto,
} from './dto/customer-response.dto';
import {
  CustomerListItem,
  CustomerListMeta,
  CustomerPayload,
  CustomerSuccessResponse,
} from './types/customer-api.types';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('customers')
@UseFilters(CustomerExceptionFilter)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('create')
  @Version('1')
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

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List customers with filter/search/pagination' })
  @ApiOkResponse({ type: CustomerSuccessListDto })
  @ApiBadRequestResponse({ type: CustomerErrorResponseDto })
  async list(
    @Query() queryDto: ListCustomerQueryDto,
  ): Promise<CustomerSuccessResponse<CustomerListItem[], CustomerListMeta>> {
    const result = await this.customerService.list(queryDto);

    return {
      success: true,
      message: 'Customers fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
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
  @Version('1')
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
