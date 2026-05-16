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
import { ListCustomerGroupQueryDto } from './dto/list-customer-group-query.dto';
import { SaveCustomerGroupDto } from './dto/save-customer-group.dto';
import {
  CustomerGroupErrorResponseDto,
  CustomerGroupSuccessDeleteDto,
  CustomerGroupSuccessListDto,
  CustomerGroupSuccessSingleDto,
} from './dto/customer-group-response.dto';
import { CustomerGroupExceptionFilter } from './customer-group-exception.filter';
import { CustomerGroupService } from './customer-group.service';
import {
  CustomerGroupListItem,
  CustomerGroupListMeta,
  CustomerGroupPayload,
  CustomerGroupSuccessResponse,
} from './types/customer-group-api.types';

@ApiTags('Customer Groups')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(3600)
@Controller('customer-groups')
@UseFilters(CustomerGroupExceptionFilter)
export class CustomerGroupController {
  constructor(private readonly customerGroupService: CustomerGroupService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update customer group (by cgrId presence)' })
  @ApiCreatedResponse({ type: CustomerGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: CustomerGroupErrorResponseDto })
  @ApiConflictResponse({ type: CustomerGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerGroupErrorResponseDto })
  async save(
    @Body() saveCustomerGroupDto: SaveCustomerGroupDto,
  ): Promise<CustomerGroupSuccessResponse<CustomerGroupPayload>> {
    const data = await this.customerGroupService.save(saveCustomerGroupDto);

    return {
      success: true,
      message: saveCustomerGroupDto.cgrId
        ? 'Customer group updated successfully'
        : 'Customer group created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List customer groups with filter/search/pagination' })
  @ApiOkResponse({ type: CustomerGroupSuccessListDto })
  @ApiBadRequestResponse({ type: CustomerGroupErrorResponseDto })
  async list(
    @Query() queryDto: ListCustomerGroupQueryDto,
  ): Promise<CustomerGroupSuccessResponse<CustomerGroupListItem[], CustomerGroupListMeta>> {
    const result = await this.customerGroupService.list(queryDto);

    return {
      success: true,
      message: 'Customer groups fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get customer group by id' })
  @ApiQuery({ name: 'cgrId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CustomerGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: CustomerGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerGroupErrorResponseDto })
  async getById(
    @Query('cgrId', new ParseUUIDPipe({ version: '7' })) cgrId: string,
  ): Promise<CustomerGroupSuccessResponse<CustomerGroupPayload>> {
    const data = await this.customerGroupService.getById(cgrId);

    return {
      success: true,
      message: 'Customer group fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete customer group by id' })
  @ApiQuery({ name: 'cgrId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CustomerGroupSuccessDeleteDto })
  @ApiBadRequestResponse({ type: CustomerGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: CustomerGroupErrorResponseDto })
  async remove(
    @Query('cgrId', new ParseUUIDPipe({ version: '7' })) cgrId: string,
  ): Promise<CustomerGroupSuccessResponse<{ cgrId: string; deleted: true }>> {
    const data = await this.customerGroupService.softDelete(cgrId);

    return {
      success: true,
      message: 'Customer group deleted successfully',
      data,
    };
  }
}
