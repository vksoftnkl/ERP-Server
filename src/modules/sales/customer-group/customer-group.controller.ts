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
import { SaveCustomerGroupDto } from './dto/save-customer-group.dto';
import {
  CustomerGroupErrorResponseDto,
  CustomerGroupSuccessDeleteDto,
  CustomerGroupSuccessSingleDto,
} from './dto/customer-group-response.dto';
import { CustomerGroupExceptionFilter } from './customer-group-exception.filter';
import { CustomerGroupService } from './customer-group.service';
import {
  CustomerGroupPayload,
  CustomerGroupSuccessResponse,
} from './types/customer-group-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Customer Groups')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('customer-groups')
@UseFilters(CustomerGroupExceptionFilter)
export class CustomerGroupController {
  constructor(private readonly customerGroupService: CustomerGroupService) {}

  @Post('create')
  @Version(API_VERSION)
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

  @Get('get')
  @Version(API_VERSION)
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
  @Version(API_VERSION)
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
