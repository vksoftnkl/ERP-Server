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
import { LedgerBankAccountExceptionFilter } from './ledger-bank-account-exception.filter';
import {
  LedgerBankAccountErrorResponseDto,
  LedgerBankAccountSuccessDeleteDto,
  LedgerBankAccountSuccessSingleDto,
} from './dto/ledger-bank-account-response.dto';
import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import { LedgerBankAccountService } from './ledger-bank-account.service';
import {
  LedgerBankAccountPayload,
  LedgerBankAccountSuccessResponse,
} from './types/ledger-bank-account-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Ledger Bank Accounts')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('ledger-bank-accounts')
@UseFilters(LedgerBankAccountExceptionFilter)
export class LedgerBankAccountController {
  constructor(private readonly ledgerBankAccountService: LedgerBankAccountService) { }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update ledger bank account (by lbaId presence)' })
  @ApiCreatedResponse({ type: LedgerBankAccountSuccessSingleDto })
  @ApiBadRequestResponse({ type: LedgerBankAccountErrorResponseDto })
  @ApiConflictResponse({ type: LedgerBankAccountErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerBankAccountErrorResponseDto })
  async save(
    @Body() saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): Promise<LedgerBankAccountSuccessResponse<LedgerBankAccountPayload>> {
    const data = await this.ledgerBankAccountService.save(saveLedgerBankAccountDto);

    return {
      success: true,
      message: saveLedgerBankAccountDto.lbaId
        ? 'Ledger bank account updated successfully'
        : 'Ledger bank account created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get ledger bank account by id' })
  @ApiQuery({ name: 'lbaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: LedgerBankAccountSuccessSingleDto })
  @ApiBadRequestResponse({ type: LedgerBankAccountErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerBankAccountErrorResponseDto })
  async getById(
    @Query('lbaId', new ParseUUIDPipe({ version: '7' })) lbaId: string,
  ): Promise<LedgerBankAccountSuccessResponse<LedgerBankAccountPayload>> {
    const data = await this.ledgerBankAccountService.getById(lbaId);

    return {
      success: true,
      message: 'Ledger bank account fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete ledger bank account by id' })
  @ApiQuery({ name: 'lbaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: LedgerBankAccountSuccessDeleteDto })
  @ApiBadRequestResponse({ type: LedgerBankAccountErrorResponseDto })
  @ApiNotFoundResponse({ type: LedgerBankAccountErrorResponseDto })
  async remove(
    @Query('lbaId', new ParseUUIDPipe({ version: '7' })) lbaId: string,
  ): Promise<LedgerBankAccountSuccessResponse<{ lbaId: string; deleted: true }>> {
    const data = await this.ledgerBankAccountService.softDelete(lbaId);

    return {
      success: true,
      message: 'Ledger bank account deleted successfully',
      data,
    };
  }
}
