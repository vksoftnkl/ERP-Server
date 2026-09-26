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
import { TxnHoldExceptionFilter } from './txn-hold-exception.filter';
import {
  TxnHoldErrorResponseDto,
  TxnHoldSuccessDeleteDto,
  TxnHoldSuccessListDto,
  TxnHoldSuccessSingleDto,
} from './dto/txn-hold-response.dto';
import { ListTxnHoldQueryDto } from './dto/list-txn-hold-query.dto';
import { ConvertTxnHoldDto, LockTxnHoldDto } from './dto/lock-txn-hold.dto';
import { SaveTxnHoldDto } from './dto/save-txn-hold.dto';
import { TxnHoldService } from './txn-hold.service';
import {
  TxnHoldDeleteResult,
  TxnHoldListItem,
  TxnHoldListMeta,
  TxnHoldPayload,
  TxnHoldSuccessResponse,
} from './types/txn-hold-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
// The lease is taken by the DEVICE, and the device names itself in a header
// rather than the body so the same value identifies the caller on every lock
// endpoint and no payload field can disagree with it. It is a
// fixed.device_master uuid — txh_locked_device_id is a real FK now, not the
// free-text till name the old transaction_hold table carried.
const DEVICE_ID_HEADER = 'x-device-id';
const DEVICE_ID_HEADER_DOC = {
  name: 'X-Device-Id',
  required: true,
  description: 'fixed.device_master.dev_id — the till taking, holding or spending the lease',
  schema: { type: 'string', format: 'uuid' },
} as const;
// txn_hold is partitioned by accounting year, so the year is half the primary
// key. Every single-row route takes it as an optional query parameter: sent, the
// lookup is pruned to one partition; omitted, it scans every year on record and
// still answers correctly.
const ACC_YEAR_QUERY_DOC = {
  name: 'txhAccYear',
  required: false,
  description: 'Accounting year (YYYY-YYYY) — prunes the lookup to one partition',
  schema: { type: 'string', minLength: 9, maxLength: 9, example: '2026-2027' },
} as const;
@ApiTags('Transaction Hold')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('txn-holds')
@UseFilters(TxnHoldExceptionFilter)
export class TxnHoldController {
  constructor(private readonly txnHoldService: TxnHoldService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update one hold (by txhId presence)',
    description:
      'A create needs txhCompanyId, txhBranchId, txhAccYear, txhSrcModule, txhDocType, ' +
      'txhDeviceId, txhHeldBy and txhPayload; txhHoldNo / txhHoldSlno are optional, since ' +
      'only a HOLD prints a token slip. An update needs txhId ' +
      'plus the fields that change; the company / branch / accounting year scope is immutable ' +
      '(the year is half the primary key), and a hold already CONVERTED, EXPIRED, CANCELLED or ' +
      'ABANDONED cannot be reopened. Posting txhKind=AUTOSAVE OVERWRITES this screen’s live ' +
      'snapshot in place and bumps txhRevision instead of creating a second row. The lease and ' +
      'conversion columns are not writable here — the endpoints below move them as whole blocks.',
  })
  @ApiCreatedResponse({ type: TxnHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiConflictResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  async save(
    @Body() saveTxnHoldDto: SaveTxnHoldDto,
  ): Promise<TxnHoldSuccessResponse<TxnHoldPayload>> {
    const data = await this.txnHoldService.save(saveTxnHoldDto);
    return {
      success: true,
      message: saveTxnHoldDto.txhId ? 'Hold updated successfully' : 'Hold created successfully',
      data,
    };
  }
  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List holds with search, filters and pagination',
    description:
      'Newest first. Soft-deleted holds are never returned. Pass txhKind=HOLD for the ' +
      'operator-facing pick list — AUTOSAVE snapshots and TEMPLATEs share the table. Sending ' +
      'any filter beyond `search` takes the query off the configured grid and onto the ' +
      'module’s own query.',
  })
  @ApiOkResponse({ type: TxnHoldSuccessListDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  async list(
    @Query() queryDto: ListTxnHoldQueryDto,
  ): Promise<TxnHoldSuccessResponse<TxnHoldListItem[], TxnHoldListMeta>> {
    const result = await this.txnHoldService.list(queryDto);
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
  @ApiQuery({ name: 'txhId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery(ACC_YEAR_QUERY_DOC)
  @ApiOkResponse({ type: TxnHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  async getById(
    @Query('txhId', new ParseUUIDPipe()) txhId: string,
    @Query('txhAccYear') txhAccYear?: string,
  ): Promise<TxnHoldSuccessResponse<TxnHoldPayload>> {
    const data = await this.txnHoldService.getById(txhId, txhAccYear);
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
    summary: 'Resume a hold onto this device, taking its lease',
    description:
      'HELD → LOCKED, leased to the authenticated operator on the X-Device-Id device until ' +
      'lockTtlSeconds have passed. Answers the whole hold including txhPayload and the fresh ' +
      'txhLockToken, so the till can redraw the screen and prove the lease later. A hold whose ' +
      'lease has ALREADY LAPSED is taken over without a force-release — that is what stops a ' +
      'till that died mid-edit from stranding a cart. A hold under a live lease held by another ' +
      'device answers 409; by the SAME device it answers 200 without a second resume count or a ' +
      'longer lease, so a retried request is harmless. A TEMPLATE is copied, not leased (400).',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TxnHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  @ApiConflictResponse({ type: TxnHoldErrorResponseDto })
  async resume(
    @Param('id', new ParseUUIDPipe()) txhId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() lockDto: LockTxnHoldDto,
  ): Promise<TxnHoldSuccessResponse<TxnHoldPayload>> {
    const data = await this.txnHoldService.resumeHold(txhId, deviceId, lockDto);
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
    summary: 'Release the lease this device holds, without billing',
    description:
      'LOCKED → HELD, so another till can recall the same parked work. Only the device holding ' +
      'the lease may release it (403 otherwise), and when txhLockToken is sent it must be the ' +
      'one resume answered with. A hold that is already HELD answers 200 unchanged. ' +
      'txhResumedBy / txhResumedOn / txhResumeCount are left as the history they are.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TxnHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiForbiddenResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  @ApiConflictResponse({ type: TxnHoldErrorResponseDto })
  async release(
    @Param('id', new ParseUUIDPipe()) txhId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() lockDto: LockTxnHoldDto,
  ): Promise<TxnHoldSuccessResponse<TxnHoldPayload>> {
    const data = await this.txnHoldService.releaseHold(txhId, deviceId, lockDto);
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
    summary: 'Take the lease away from the device holding it',
    description:
      'LOCKED → HELD without the ownership check — for the cart the floor needs back before the ' +
      'lease lapses on its own. A separate route from /release on purpose: it interrupts ' +
      'whoever is on the hold, and the audit entry names both devices. It cannot reopen a ' +
      'closed hold (409), and an already-HELD one answers 200 unchanged. RESUMED is cleared ' +
      'too — that is what "in use" means for a row driven through the CRUD route.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TxnHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  @ApiConflictResponse({ type: TxnHoldErrorResponseDto })
  async forceRelease(
    @Param('id', new ParseUUIDPipe()) txhId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() lockDto: LockTxnHoldDto,
  ): Promise<TxnHoldSuccessResponse<TxnHoldPayload>> {
    const data = await this.txnHoldService.forceReleaseHold(txhId, deviceId, lockDto);
    return {
      success: true,
      message: 'Hold lease released successfully',
      data,
    };
  }

  @Post(':id/convert')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close the hold onto the document it became',
    description:
      'LOCKED → CONVERTED (terminal): stamps the conversion trail and drops the lease, so the ' +
      'parked work can never be resumed or billed again (409). There is no converted doc type ' +
      'to send — a hold becomes the document it was parked as, so the stored txhDocType names ' +
      'it — but txhConvertedAccYear does travel with the id, since a March hold can become an ' +
      'April document. Only the device holding the lease may convert it: 403 otherwise, and ' +
      'nothing is written.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' }, description: 'txhId' })
  @ApiHeader(DEVICE_ID_HEADER_DOC)
  @ApiOkResponse({ type: TxnHoldSuccessSingleDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiForbiddenResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  @ApiConflictResponse({ type: TxnHoldErrorResponseDto })
  async convert(
    @Param('id', new ParseUUIDPipe()) txhId: string,
    @Headers(DEVICE_ID_HEADER) deviceId: string | undefined,
    @Body() convertDto: ConvertTxnHoldDto,
  ): Promise<TxnHoldSuccessResponse<TxnHoldPayload>> {
    const data = await this.txnHoldService.convertHold(txhId, deviceId, convertDto, {
      txhConvertedDocId: convertDto.txhConvertedDocId,
      txhConvertedAccYear: convertDto.txhConvertedAccYear,
      txhConvertedRefno: convertDto.txhConvertedRefno,
      txhConvertedBy: convertDto.txhConvertedBy,
    });
    return {
      success: true,
      message: 'Hold converted successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete hold by id',
    description:
      'The row stays, flagged. Both unique indexes are partial on txh_is_deleted, so deleting ' +
      'frees the hold number and the device serial for reuse.',
  })
  @ApiQuery({ name: 'txhId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery(ACC_YEAR_QUERY_DOC)
  @ApiOkResponse({ type: TxnHoldSuccessDeleteDto })
  @ApiBadRequestResponse({ type: TxnHoldErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnHoldErrorResponseDto })
  async remove(
    @Query('txhId', new ParseUUIDPipe()) txhId: string,
    @Query('txhAccYear') txhAccYear?: string,
  ): Promise<TxnHoldSuccessResponse<TxnHoldDeleteResult>> {
    const data = await this.txnHoldService.softDelete(txhId, txhAccYear);
    return {
      success: true,
      message: 'Hold deleted successfully',
      data,
    };
  }
}
