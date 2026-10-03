import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  ValidationPipe,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { AccountLedgerMasterExceptionFilter } from './account-ledger-master-exception.filter';
import {
  AccountLedgerMasterBankAccountListDto,
  AccountLedgerMasterBankAccountSingleDto,
  AccountLedgerMasterBankAccountsDeleteDto,
  AccountLedgerMasterErrorResponseDto,
  AccountLedgerMasterSuccessDeleteDto,
  AccountLedgerMasterSuccessListDto,
  AccountLedgerMasterSuccessSingleDto,
} from './dto/account-ledger-master-response.dto';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import { SaveBulkAccountLedgerMasterDto } from './dto/save-bulk-account-ledger-master.dto';
import { AccountLedgerMastersService } from './account-ledger-masters.service';
import {
  AccountLedgerMasterPayload,
  AccountLedgerMasterSuccessResponse,
  LedgerBankAccountPayload,
} from './types/account-ledger-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Account Ledger Masters')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('account-ledger-masters')
@UseFilters(AccountLedgerMasterExceptionFilter)
export class AccountLedgerMastersController {
  constructor(private readonly accountLedgerMastersService: AccountLedgerMastersService) {}

  // The /create route accepts a union (single object or { data: [...] }), so Nest's global
  // ValidationPipe skips it (the reflected metatype is Object). We validate explicitly with
  // the same options once we know which DTO the body resolves to.
  private readonly bodyValidationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update account ledger(s) — single object or { data: [...] } batch',
    description: [
      'Accepts either a single ledger object or a batch wrapped as `{ "data": [ ... ] }`.',
      '',
      '- Omit `ledId` to create; include it to update the existing ledger.',
      '- In batch mode every entry follows the same rule and the whole array is persisted in',
      '  one transaction (all-or-nothing): if any entry fails, nothing is saved.',
    ].join('\n'),
  })
  @ApiExtraModels(
    SaveAccountLedgerMasterDto,
    SaveBulkAccountLedgerMasterDto,
    AccountLedgerMasterSuccessSingleDto,
    AccountLedgerMasterSuccessListDto,
  )
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SaveAccountLedgerMasterDto) },
        { $ref: getSchemaPath(SaveBulkAccountLedgerMasterDto) },
      ],
    },
  })
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AccountLedgerMasterSuccessSingleDto) },
        { $ref: getSchemaPath(AccountLedgerMasterSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiConflictResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async save(
    @Body() body: SaveAccountLedgerMasterDto | SaveBulkAccountLedgerMasterDto,
  ): Promise<
    AccountLedgerMasterSuccessResponse<AccountLedgerMasterPayload | AccountLedgerMasterPayload[]>
  > {
    if (this.isBulkPayload(body)) {
      const { data: dtos } = await this.validateBody(body, SaveBulkAccountLedgerMasterDto);
      const data = await this.accountLedgerMastersService.saveMany(dtos);
      return {
        success: true,
        message: 'Account ledgers saved successfully',
        data,
      };
    }
    const dto = await this.validateBody(body, SaveAccountLedgerMasterDto);
    const data = await this.accountLedgerMastersService.save(dto);
    return {
      success: true,
      message: dto.ledId
        ? 'Account ledger updated successfully'
        : 'Account ledger created successfully',
      data,
    };
  }

  // A batch body is the wrapped `{ data: [...] }` shape; anything else is a single ledger.
  private isBulkPayload(body: unknown): body is SaveBulkAccountLedgerMasterDto {
    return (
      typeof body === 'object' && body !== null && Array.isArray((body as { data?: unknown }).data)
    );
  }

  private async validateBody<T>(body: unknown, metatype: new () => T): Promise<T> {
    return (await this.bodyValidationPipe.transform(body, {
      type: 'body',
      metatype,
    })) as T;
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get account ledger by id, or list all account ledgers',
    description: 'Pass ledId to fetch a single ledger. Otherwise returns all account ledgers.',
  })
  @ApiQuery({ name: 'ledId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiOkResponse({ type: AccountLedgerMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async get(
    @Query(
      'ledId',
      new DefaultValuePipe(undefined),
      new ParseUUIDPipe({ version: '7', optional: true }),
    )
    ledId: string | undefined,
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

    const data = await this.accountLedgerMastersService.get();
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

  @Get('get-bank')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get a ledger bank account by id, or list all bank accounts for a ledger',
    description:
      'Pass lbaId to fetch a single bank account. Otherwise pass ledId to list every active ' +
      'bank account for that ledger. Exactly one of lbaId or ledId is required.',
  })
  @ApiQuery({ name: 'lbaId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiQuery({ name: 'ledId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiOkResponse({ type: AccountLedgerMasterBankAccountSingleDto })
  @ApiOkResponse({ type: AccountLedgerMasterBankAccountListDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async getBank(
    @Query(
      'lbaId',
      new DefaultValuePipe(undefined),
      new ParseUUIDPipe({ version: '7', optional: true }),
    )
    lbaId: string | undefined,
    @Query(
      'ledId',
      new DefaultValuePipe(undefined),
      new ParseUUIDPipe({ version: '7', optional: true }),
    )
    ledId: string | undefined,
  ): Promise<
    AccountLedgerMasterSuccessResponse<
      LedgerBankAccountPayload | { data: LedgerBankAccountPayload[]; total: number }
    >
  > {
    if (lbaId) {
      const data = await this.accountLedgerMastersService.getBankAccounts({ lbaId });
      return {
        success: true,
        message: 'Ledger bank account fetched successfully',
        data,
      };
    }
    if (ledId) {
      const data = await this.accountLedgerMastersService.getBankAccounts({ ledId });
      return {
        success: true,
        message: 'Ledger bank accounts fetched successfully',
        data,
      };
    }
    const data = await this.accountLedgerMastersService.getBankAccounts({});
    return {
      success: true,
      message: 'Ledger bank accounts fetched successfully',
      data,
    };
  }

  @Delete('delete-bank')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a ledger bank account by id',
    description:
      'Soft deletes a single bank account by its own id (lbaId), GST/audit retention safe. ' +
      'Use the nested array on create/update to add or edit individual bank accounts.',
  })
  @ApiQuery({ name: 'lbaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AccountLedgerMasterBankAccountsDeleteDto })
  @ApiBadRequestResponse({ type: AccountLedgerMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountLedgerMasterErrorResponseDto })
  async removeBankAccounts(
    @Query('lbaId', new ParseUUIDPipe({ version: '7' })) lbaId: string,
  ): Promise<AccountLedgerMasterSuccessResponse<{ lbaId: string; deleted: true }>> {
    const data = await this.accountLedgerMastersService.deleteBankAccountById(lbaId);
    return {
      success: true,
      message: 'Ledger bank account deleted successfully',
      data,
    };
  }
}
