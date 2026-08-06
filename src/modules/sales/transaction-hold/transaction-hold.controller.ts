import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { ConvertTransactionHoldDto, LockTransactionHoldDto } from './dto/lock-transaction-hold.dto';
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
// The edit lock is held by the DEVICE, not the operator, and the device names
// itself in a header rather than the body so the same value identifies the
// caller on every lock endpoint and no payload field can disagree with it.
const DEVICE_ID_HEADER = 'x-device-id';
const DEVICE_ID_HEADER_DOC = {
  name: 'X-Device-Id',
  required: true,
  description: 'Device taking, holding or spending the edit lock (max 64 chars)',
  schema: { type: 'string', maxLength: 64 },
} as const;
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
  @Post(':id/resume')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume a hold onto this device, taking its edit lock',
    description:
      'HELD → LOCKED, held by the X-Device-Id device. Answers the whole hold including ' +
      'thUiState so the till can redraw the screen. A hold already LOCKED by another device ' +
      'answers 409; by the SAME device it answers 200 without a second resume count, so a ' +
      'retried request is harmless. There is no timeout — the lock lasts until it is released.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'thId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TransactionHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  @ApiConflictResponse({ type: TransactionHoldErrorResponseDto })
  async resume(
    @Param('id', new ParseUUIDPipe()) thId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() lockDto: LockTransactionHoldDto,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldPayload>> {
    const data = await this.transactionHoldService.resumeHold(thId, deviceId, lockDto);
    return {
      success: true,
      message: 'Hold resumed successfully',
      data,
    };
  }

  @Post(':id/release')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release the edit lock this device holds, without billing',
    description:
      'LOCKED → HELD, so another till can recall the same parked bill. Only the device ' +
      'holding the lock may release it (403 otherwise); a hold that is already HELD answers ' +
      '200 unchanged. thResumedBy / thResumedAt / thResumeCount are left as the history they are.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'thId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TransactionHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiForbiddenResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  @ApiConflictResponse({ type: TransactionHoldErrorResponseDto })
  async release(
    @Param('id', new ParseUUIDPipe()) thId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() lockDto: LockTransactionHoldDto,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldPayload>> {
    const data = await this.transactionHoldService.releaseHold(thId, deviceId, lockDto);
    return {
      success: true,
      message: 'Hold released successfully',
      data,
    };
  }

  @Post(':id/force-release')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Take the edit lock away from the device holding it',
    description:
      'LOCKED → HELD without the ownership check — the escape hatch for a device that died ' +
      'holding a cart, since there is no timeout or auto-release. A separate route from ' +
      '/release on purpose: it interrupts whoever is on the hold, and the audit entry names ' +
      'both devices. It cannot reopen a closed hold (409), and an already-HELD one answers ' +
      '200 unchanged. RESUMED is cleared too — that is what "in use" meant before this lock.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'thId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TransactionHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  @ApiConflictResponse({ type: TransactionHoldErrorResponseDto })
  async forceRelease(
    @Param('id', new ParseUUIDPipe()) thId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() lockDto: LockTransactionHoldDto,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldPayload>> {
    const data = await this.transactionHoldService.forceReleaseHold(thId, deviceId, lockDto);
    return {
      success: true,
      message: 'Hold lock released successfully',
      data,
    };
  }

  @Post(':id/convert')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close the hold onto the document it became',
    description:
      'LOCKED → CONVERTED (terminal): stamps the conversion trace and drops the lock, so the ' +
      'parked cart can never be resumed or billed again (409). Only the device holding the ' +
      'lock may convert it — 403 otherwise, and nothing is written.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'thId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TransactionHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TransactionHoldErrorResponseDto })
  @ApiForbiddenResponse({ type: TransactionHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TransactionHoldErrorResponseDto })
  @ApiConflictResponse({ type: TransactionHoldErrorResponseDto })
  async convert(
    @Param('id', new ParseUUIDPipe()) thId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() convertDto: ConvertTransactionHoldDto,
  ): Promise<TransactionHoldSuccessResponse<TransactionHoldPayload>> {
    const data = await this.transactionHoldService.convertHold(thId, deviceId, convertDto, {
      thConvertedDocType: convertDto.thConvertedDocType,
      thConvertedDocId: convertDto.thConvertedDocId,
      thConvertedNo: convertDto.thConvertedNo,
      thConvertedBy: convertDto.thConvertedBy,
    });
    return {
      success: true,
      message: 'Hold converted successfully',
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
