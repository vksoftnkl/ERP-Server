import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Put,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { API_VERSION } from '../../../common/constants/api-version';
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
import { BillLifecycleService } from './bill-lifecycle.service';
import { BillReadService } from './bill-read.service';
import { BillBandService } from './bill-band.service';
import { BillRetenderService } from './bill-retender.service';
import { SaveBillDto } from './dto/save-bill.dto';
import {
  AmendBillDto,
  BillTransportDto,
  CancelBillDto,
  DeleteBillDto,
  DeliveryStatusDto,
  PostBillDto,
  RetenderBillDto,
  UpdateRemarksDto,
  ValidateBillDto,
} from './dto/bill-lifecycle.dto';
import { BillErrorResponseDto, BillSuccessSingleDto } from './dto/bill-response.dto';
import type { BillPayload, BillSuccessResponse } from './types/bill-api.types';

/**
 * HANDOVER §2 — `/api/v1/bills`.
 *
 * Every success is `{ success, message, data }` (the house envelope); every
 * error is the module filter's `{ statusCode, success, message, errors[] }`
 * where each error carries the `code` the client switches on. A 422 from
 * `/validate`-style refusals carries every refusal, not just the first.
 */
@ApiTags('Bills')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: BillErrorResponseDto })
@ApiConflictResponse({ type: BillErrorResponseDto })
@ApiUnprocessableEntityResponse({ type: BillErrorResponseDto })
@CacheTTL(1)
@Controller('bills')
@UseFilters(BillExceptionFilter)
export class BillController {
  constructor(
    private readonly billService: BillService,
    private readonly lifecycle: BillLifecycleService,
    private readonly read: BillReadService,
    private readonly band: BillBandService,
    private readonly retenderService: BillRetenderService,
  ) {}

  private ok<T>(message: string, data: T): BillSuccessResponse<T> {
    return { success: true, message, data };
  }

  // ── §2.1 ──────────────────────────────────────────────────────────────────
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a DRAFT bill (by sbId presence)',
    description:
      'sbStatus in the body is ignored — a saved bill is a DRAFT until /bills/post. A POSTED sbId ' +
      'answers 409 SALES_BILL_POSTED (use /bills/amend). Ship-to / dispatch / transport fields write ' +
      'the OUTWARD transport band. Answers the /get shape.',
  })
  @ApiCreatedResponse({ type: BillSuccessSingleDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async save(@Body() dto: SaveBillDto): Promise<BillSuccessResponse<BillPayload>> {
    const data = await this.billService.save(dto);
    return this.ok(dto.sbId ? 'Bill updated successfully' : 'Bill created successfully', data);
  }

  // ── §2.2 ──────────────────────────────────────────────────────────────────
  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Dry-run the post: every refusal and warning, plus proposals. Writes nothing.',
  })
  @ApiOkResponse({ description: '{ ok, refusals[], warnings[], rights, proposals }' })
  async validate(
    @Body() dto: ValidateBillDto,
  ): Promise<BillSuccessResponse<Record<string, unknown>>> {
    return this.ok('Bill validated', await this.lifecycle.validate(dto));
  }

  // ── §2.3 ──────────────────────────────────────────────────────────────────
  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post a DRAFT bill — the one-way door',
    description:
      'One transaction: stock, legs, register, receivable, set-offs, temp credits, loyalty, promotions, ' +
      'charge carry, fulfilment, then status. Idempotent on a POSTED id. Refusals answer 422 with every ' +
      'code; a WARN passes only when its code is in overrides[] AND um_can_override.',
  })
  @ApiOkResponse({ type: BillSuccessSingleDto })
  async post(@Body() dto: PostBillDto): Promise<BillSuccessResponse<BillPayload>> {
    return this.ok('Bill posted successfully', await this.lifecycle.post(dto));
  }

  // ── §2.4 ──────────────────────────────────────────────────────────────────
  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Cancel a POSTED bill by reversal (never a delete). Reason mandatory.' })
  @ApiOkResponse({
    description: '{ ...keys, sbStatus: CANCELLED, reversalVoucherRefno, cancelledOn }',
  })
  async cancel(@Body() dto: CancelBillDto): Promise<BillSuccessResponse<Record<string, unknown>>> {
    return this.ok('Bill cancelled successfully', await this.lifecycle.cancel(dto));
  }

  // ── §2.5 ──────────────────────────────────────────────────────────────────
  @Post('amend')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Amend a POSTED bill (R20): unwind, re-apply, re-post, revision + 1',
    description:
      'Gated by sales.allow_posted_amend (409 SALES_AMEND_OFF), baseRevision (409 SALES_REVISION_STALE) ' +
      'and lock 2 (409 SALES_IRN_LIVE / SALES_EWB_LIVE — a declared document is cancelled, never amended).',
  })
  @ApiOkResponse({ type: BillSuccessSingleDto })
  async amend(@Body() dto: AmendBillDto): Promise<BillSuccessResponse<BillPayload>> {
    return this.ok('Bill amended successfully', await this.lifecycle.amend(dto));
  }

  // ── §2.6 ──────────────────────────────────────────────────────────────────
  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Soft-delete a DRAFT bill. A POSTED id answers 409 SALES_BILL_POSTED (use /bills/cancel).',
  })
  @ApiOkResponse({ description: '{ sbId, deleted: true }' })
  async remove(
    @Body() dto: DeleteBillDto,
  ): Promise<BillSuccessResponse<{ sbId: string; deleted: true }>> {
    return this.ok('Draft bill deleted successfully', await this.billService.deleteDraft(dto));
  }

  // ── §2.7 ──────────────────────────────────────────────────────────────────
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get bill by id — header, items, charges, tenders, posting, locks, rights, sources',
  })
  @ApiQuery({ name: 'sbId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: BillSuccessSingleDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async getById(
    @Query('sbId', new ParseUUIDPipe({ version: '7' })) sbId: string,
    @Query('sbCompanyId', new ParseUUIDPipe({ version: '7' })) sbCompanyId: string,
    @Query('sbBranchId', new ParseUUIDPipe({ version: '7' })) sbBranchId: string,
    @Query('sbAccYear') sbAccYear: string,
  ): Promise<BillSuccessResponse<BillPayload>> {
    return this.ok(
      'Bill fetched successfully',
      await this.billService.getById(sbId, sbCompanyId, sbBranchId, sbAccYear),
    );
  }

  // ── §2.8 ──────────────────────────────────────────────────────────────────
  @Get('open-sources')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Open challan / order lines of a party a bill can take' })
  @ApiQuery({ name: 'companyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'partyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'kind', schema: { type: 'string', enum: ['DC', 'ORDER'] } })
  @ApiQuery({ name: 'accYear', required: false, schema: { type: 'string' } })
  async openSources(
    @Query('companyId', new ParseUUIDPipe({ version: '7' })) companyId: string,
    @Query('branchId', new ParseUUIDPipe({ version: '7' })) branchId: string,
    @Query('partyId', new ParseUUIDPipe({ version: '7' })) partyId: string,
    @Query('kind') kind: string,
    @Query('accYear') accYear?: string,
  ): Promise<BillSuccessResponse<unknown>> {
    const k = (kind ?? '').toUpperCase() === 'ORDER' ? 'ORDER' : 'DC';
    return this.ok(
      'Open sources fetched',
      await this.read.openSources({
        companyId,
        branchId,
        partyId,
        kind: k,
        accYear: accYear || null,
      }),
    );
  }

  // ── §2.9 ──────────────────────────────────────────────────────────────────
  @Get('party-context')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Everything the screen needs on customer pick, in one call' })
  @ApiQuery({ name: 'partyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'companyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'accYear', schema: { type: 'string' } })
  @ApiQuery({ name: 'billDate', required: false, schema: { type: 'string', format: 'date' } })
  async partyContext(
    @Query('partyId', new ParseUUIDPipe({ version: '7' })) partyId: string,
    @Query('companyId', new ParseUUIDPipe({ version: '7' })) companyId: string,
    @Query('branchId', new ParseUUIDPipe({ version: '7' })) branchId: string,
    @Query('accYear') accYear: string,
    @Query('billDate') billDate?: string,
  ): Promise<BillSuccessResponse<Record<string, unknown>>> {
    return this.ok(
      'Party context fetched',
      await this.read.partyContext({
        partyId,
        companyId,
        branchId,
        accYear,
        billDate: billDate || null,
      }),
    );
  }

  // ── §2.10 ─────────────────────────────────────────────────────────────────
  @Put('delivery-status')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'VERIFIED → PACKED → DISPATCHED → DELIVERED, order enforced (409 SALES_DELIVERY_ORDER)',
  })
  async deliveryStatus(
    @Body() dto: DeliveryStatusDto,
  ): Promise<BillSuccessResponse<{ sbDeliveryStatus: string }>> {
    return this.ok('Delivery status updated', await this.band.deliveryStatus(dto));
  }

  // ── §2.11 ─────────────────────────────────────────────────────────────────
  @Put('update-remarks')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Edit the remarks of a POSTED bill — text only' })
  async updateRemarks(
    @Body() dto: UpdateRemarksDto,
  ): Promise<BillSuccessResponse<{ sbRemarks: string | null }>> {
    return this.ok('Remarks updated', await this.band.updateRemarks(dto));
  }

  // ── §2.12 ─────────────────────────────────────────────────────────────────
  @Put('transport')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'The transport band on its own verb — open between POST and declaration, refused after (GST_DECLARED_LOCKED)',
  })
  async transport(@Body() dto: BillTransportDto): Promise<BillSuccessResponse<unknown>> {
    return this.ok('Transport details saved', await this.band.transport(dto));
  }

  // ── §2.12a ────────────────────────────────────────────────────────────────
  @Get('tender-context')
  @Version(API_VERSION)
  @ApiOperation({ summary: "The re-tender dialog's ONLY read — small, no items, no party context" })
  @ApiQuery({ name: 'sbId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbAccYear', schema: { type: 'string' } })
  async tenderContext(
    @Query('sbId', new ParseUUIDPipe({ version: '7' })) sbId: string,
    @Query('sbCompanyId', new ParseUUIDPipe({ version: '7' })) sbCompanyId: string,
    @Query('sbBranchId', new ParseUUIDPipe({ version: '7' })) sbBranchId: string,
    @Query('sbAccYear') sbAccYear: string,
  ): Promise<BillSuccessResponse<Record<string, unknown>>> {
    return this.ok(
      'Tender context fetched',
      await this.read.tenderContext({ sbId, sbCompanyId, sbBranchId, sbAccYear }),
    );
  }

  // ── §2.13 ─────────────────────────────────────────────────────────────────
  @Post('retender')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Change how it was paid, not what was sold',
    description:
      'Voids the rows that did not happen (kept, td_is_voided) and writes what really happened ' +
      '(td_replaces_id). On a POSTED bill posts a TndC contra; the party balance never moves. Needs ' +
      'um_can_retender. Refused when the totals differ, the day is closed, or a PDC has moved.',
  })
  @ApiOkResponse({ type: BillSuccessSingleDto })
  async retender(@Body() dto: RetenderBillDto): Promise<BillSuccessResponse<BillPayload>> {
    return this.ok('Bill re-tendered successfully', await this.retenderService.retender(dto));
  }
}
