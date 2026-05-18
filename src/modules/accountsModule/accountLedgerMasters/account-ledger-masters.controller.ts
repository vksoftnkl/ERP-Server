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
import { AccountLedgerMasterExceptionFilter } from './account-ledger-master-exception.filter';
import {
  AccountLedgerMasterErrorResponseDto,
  AccountLedgerMasterSuccessDeleteDto,
  AccountLedgerMasterSuccessListDto,
  AccountLedgerMasterSuccessSingleDto,
} from './dto/account-ledger-master-response.dto';
import { ListAccountLedgerMasterQueryDto } from './dto/list-account-ledger-master-query.dto';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import { AccountLedgerMastersService } from './account-ledger-masters.service';
import {
  AccountLedgerMasterListItem,
  AccountLedgerMasterListMeta,
  AccountLedgerMasterPayload,
  AccountLedgerMasterSuccessResponse,
} from './types/account-ledger-master-api.types';

@ApiTags('Account Ledger Masters')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('account-ledger-masters')
@UseFilters(AccountLedgerMasterExceptionFilter)
export class AccountLedgerMastersController {
  constructor(private readonly accountLedgerMastersService: AccountLedgerMastersService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update account ledger (by ledId presence)' })
  @ApiCreatedResponse({ type: AccountLedgerMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiConflictResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async save(
    @Body() saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterSuccessResponse<AccountLedgerMasterPayload>> {
    const data = await this.accountLedgerMastersService.save(saveAccountLedgerMasterDto);

    return {
      success: true,
      message: saveAccountLedgerMasterDto.ledId
        ? 'Account ledger updated successfully'
        : 'Account ledger created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List account ledgers with filter/search/pagination' })
  @ApiOkResponse({ type: AccountLedgerMasterSuccessListDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListAccountLedgerMasterQueryDto,
  ): Promise<
    AccountLedgerMasterSuccessResponse<AccountLedgerMasterListItem[], AccountLedgerMasterListMeta>
  > {
    const result = await this.accountLedgerMastersService.list(queryDto);

    return {
      success: true,
      message: 'Account ledgers fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get account ledger by id' })
  @ApiQuery({ name: 'ledId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AccountLedgerMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async getById(
    @Query('ledId', new ParseUUIDPipe({ version: '7' })) ledId: string,
  ): Promise<AccountLedgerMasterSuccessResponse<AccountLedgerMasterPayload>> {
    const data = await this.accountLedgerMastersService.getById(ledId);

    return {
      success: true,
      message: 'Account ledger fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete account ledger by id' })
  @ApiQuery({ name: 'ledId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AccountLedgerMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async remove(
    @Query('ledId', new ParseUUIDPipe({ version: '7' })) ledId: string,
  ): Promise<AccountLedgerMasterSuccessResponse<{ ledId: string; deleted: true }>> {
    const data = await this.accountLedgerMastersService.softDelete(ledId);

    return {
      success: true,
      message: 'Account ledger deleted successfully',
      data,
    };
  }
}
