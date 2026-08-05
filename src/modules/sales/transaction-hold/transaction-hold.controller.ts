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
import { TransactionHoldExceptionFilter } from './transaction-hold-exception.filter';
import {
  TransactionHoldErrorResponseDto,
  TransactionHoldSuccessDeleteDto,
  TransactionHoldSuccessListDto,
  TransactionHoldSuccessSingleDto,
} from './dto/transaction-hold-response.dto';
import { ListTransactionHoldQueryDto } from './dto/list-transaction-hold-query.dto';
import { SaveTransactionHoldDto } from './dto/save-transaction-hold.dto';
import { TransactionHoldService } from './transaction-hold.service';
import {
  TransactionHoldDeleteResult,
  TransactionHoldListItem,
  TransactionHoldListMeta,
  TransactionHoldPayload,
  TransactionHoldSuccessResponse,
} from './types/transaction-hold-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Transaction Hold')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('transaction-holds')
@UseFilters(TransactionHoldExceptionFilter)
export class TransactionHoldController {
  constructor(private readonly transactionHoldService: TransactionHoldService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update one hold (by thId presence)',
    description:
      'A create needs thCompanyId, thBranchId, thAccYear, thHoldNo, thDeviceId and thDeviceType. ' +
      'An update needs thId plus the fields that change; the company / branch / accounting year ' +
      'scope is immutable, and a hold already CONVERTED, CANCELLED or EXPIRED cannot be reopened.',
  })
  @ApiCreatedResponse({ type: TransactionHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiConflictResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  async save(
    @Body() saveTransactionHoldDto: SaveTransactionHoldDto,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldPayload>> {
    const data = await this.transactionHoldService.save(saveTransactionHoldDto);
    return {
      success: true,
      message: saveTransactionHoldDto.thId
        ? 'Hold updated successfully'
        : 'Hold created successfully',
      data,
    };
  }
  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List holds with search, filters and pagination',
    description:
      'Newest first. Soft-deleted holds are never returned. Sending any filter beyond `search` ' +
      'takes the query off the configured grid and onto the module’s own query.',
  })
  @ApiOkResponse({ type: TransactionHoldSuccessListDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  async list(
    @Query() queryDto: ListTransactionHoldQueryDto,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldListItem[], TransactionHoldListMeta>> {
    const result = await this.transactionHoldService.list(queryDto);
    return {
      success: true,
      message: 'Holds fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get hold by id' })
  @ApiQuery({ name: 'thId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: TransactionHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  async getById(
    @Query('thId', new ParseUUIDPipe()) thId: string,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldPayload>> {
    const data = await this.transactionHoldService.getById(thId);
    return {
      success: true,
      message: 'Hold fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete hold by id' })
  @ApiQuery({ name: 'thId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: TransactionHoldSuccessDeleteDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  async remove(
    @Query('thId', new ParseUUIDPipe()) thId: string,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldDeleteResult>> {
    const data = await this.transactionHoldService.softDelete(thId);
    return {
      success: true,
      message: 'Hold deleted successfully',
      data,
    };
  }
}
