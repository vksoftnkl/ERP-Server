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
  AccountVoucherTypeErrorResponseDto,
  AccountVoucherTypeSuccessDeleteDto,
  AccountVoucherTypeSuccessListDto,
  AccountVoucherTypeSuccessSingleDto,
} from './dto/account-voucher-type-response.dto';
import { ListAccountVoucherTypeQueryDto } from './dto/list-account-voucher-type-query.dto';
import { SaveAccountVoucherTypeDto } from './dto/save-account-voucher-type.dto';
import { AccountVoucherTypeExceptionFilter } from './account-voucher-type-exception.filter';
import { AccountVoucherTypeService } from './account-voucher-type.service';
import {
  AccountVoucherTypeListItem,
  AccountVoucherTypeListMeta,
  AccountVoucherTypePayload,
  AccountVoucherTypeSuccessResponse,
} from './types/account-voucher-type-api.types';

@ApiTags('Account Voucher Types')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('account-voucher-types')
@UseFilters(AccountVoucherTypeExceptionFilter)
export class AccountVoucherTypeController {
  constructor(private readonly accountVoucherTypeService: AccountVoucherTypeService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update account voucher type (by avtId presence)' })
  @ApiCreatedResponse({ type: AccountVoucherTypeSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountVoucherTypeErrorResponseDto })
  @ApiConflictResponse({ type: AccountVoucherTypeErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountVoucherTypeErrorResponseDto })
  async save(
    @Body() saveAccountVoucherTypeDto: SaveAccountVoucherTypeDto,
  ): Promise<AccountVoucherTypeSuccessResponse<AccountVoucherTypePayload>> {
    const data = await this.accountVoucherTypeService.save(saveAccountVoucherTypeDto);

    return {
      success: true,
      message: saveAccountVoucherTypeDto.avtId
        ? 'Account voucher type updated successfully'
        : 'Account voucher type created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List account voucher types with filter/search/pagination' })
  @ApiOkResponse({ type: AccountVoucherTypeSuccessListDto })
  @ApiBadRequestResponse({ type: AccountVoucherTypeErrorResponseDto })
  async list(
    @Query() queryDto: ListAccountVoucherTypeQueryDto,
  ): Promise<
    AccountVoucherTypeSuccessResponse<AccountVoucherTypeListItem[], AccountVoucherTypeListMeta>
  > {
    const result = await this.accountVoucherTypeService.list(queryDto);

    return {
      success: true,
      message: 'Account voucher types fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:avtId')
  @Version('1')
  @ApiOperation({ summary: 'Get account voucher type by id' })
  @ApiParam({ name: 'avtId', format: 'uuid' })
  @ApiOkResponse({ type: AccountVoucherTypeSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountVoucherTypeErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountVoucherTypeErrorResponseDto })
  async getById(
    @Param('avtId', new ParseUUIDPipe({ version: '7' })) avtId: string,
  ): Promise<AccountVoucherTypeSuccessResponse<AccountVoucherTypePayload>> {
    const data = await this.accountVoucherTypeService.getById(avtId);

    return {
      success: true,
      message: 'Account voucher type fetched successfully',
      data,
    };
  }

  @Delete('delete/:avtId')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete account voucher type by id' })
  @ApiParam({ name: 'avtId', format: 'uuid' })
  @ApiOkResponse({ type: AccountVoucherTypeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AccountVoucherTypeErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountVoucherTypeErrorResponseDto })
  async remove(
    @Param('avtId', new ParseUUIDPipe({ version: '7' })) avtId: string,
  ): Promise<AccountVoucherTypeSuccessResponse<{ avtId: string; deleted: true }>> {
    const data = await this.accountVoucherTypeService.softDelete(avtId);

    return {
      success: true,
      message: 'Account voucher type deleted successfully',
      data,
    };
  }
}
