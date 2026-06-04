import { CacheTTL } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
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
  AccountLedgerMasterSuccessSingleDto,
} from './dto/account-ledger-master-response.dto';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import { AccountLedgerMastersService } from './account-ledger-masters.service';
import {
  AccountLedgerMasterPayload,
  AccountLedgerMasterSuccessResponse,
} from './types/account-ledger-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Account Ledger Masters')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('account-ledger-masters')
@UseFilters(AccountLedgerMasterExceptionFilter)
export class AccountLedgerMastersController {
  constructor(private readonly accountLedgerMastersService: AccountLedgerMastersService) {}

  @Post('create')
  @Version(API_VERSION)
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

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get account ledger by id, or list account ledgers by company',
    description:
      'Pass ledId to fetch a single ledger. Otherwise pass ledCompanyId (with optional ' +
      'ledIsActive/page/limit) to fetch a paginated list.',
  })
  @ApiQuery({ name: 'ledId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiQuery({ name: 'ledCompanyId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiQuery({ name: 'ledIsActive', schema: { type: 'boolean' }, required: false })
  @ApiQuery({ name: 'page', schema: { type: 'integer', default: 1 }, required: false })
  @ApiQuery({ name: 'limit', schema: { type: 'integer', default: 100 }, required: false })
  @ApiOkResponse({ type: AccountLedgerMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async get(
    @Query('ledId', new DefaultValuePipe(undefined), new ParseUUIDPipe({ version: '7', optional: true }))
    ledId: string | undefined,
    @Query('ledCompanyId', new DefaultValuePipe(undefined), new ParseUUIDPipe({ version: '7', optional: true }))
    ledCompanyId: string | undefined,
    @Query('ledIsActive', new DefaultValuePipe(undefined), new ParseBoolPipe({ optional: true }))
    ledIsActive: boolean | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<
    AccountLedgerMasterSuccessResponse<
      AccountLedgerMasterPayload | { data: AccountLedgerMasterPayload[]; total: number }
    >
  > {
    if (ledId) {
      const data = await this.accountLedgerMastersService.get({ ledId });
      return {
        success: true,
        message: 'Account ledger fetched successfully',
        data,
      };
    }

    if (!ledCompanyId) {
      throw new BadRequestException('Either ledId or ledCompanyId must be provided');
    }

    const data = await this.accountLedgerMastersService.get({
      ledCompanyId,
      ledIsActive,
      page,
      limit,
    });
    return {
      success: true,
      message: 'Account ledgers fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
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