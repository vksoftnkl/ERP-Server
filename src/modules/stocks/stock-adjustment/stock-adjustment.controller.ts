import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import type {
  StockVoucherCancelResult,
  StockVoucherDeleteResult,
  StockVoucherLineProblem,
  StockVoucherPostResult,
  StockVoucherSaveResult,
  StockVoucherSuccessResponse,
} from '../stock-voucher/types/stock-voucher.types';
import { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';
import {
  CancelStockAdjustmentDto,
  PickStockQueryDto,
  StockAdjustmentRefDto,
  StockAdjustmentRefQueryDto,
} from './dto/stock-adjustment-query.dto';
import { StockAdjustmentService, type PickStockRow, type StockAdjustmentPayload } from './stock-adjustment.service';

/**
 * ONE module, ONE screen with a Type selector, five documents
 * (plan-nestjs-stock-adjustments §0, §1; the fifth, Move stock, is notes 60).
 * The kind is on the payload at save and on the row for everything else; the
 * service pins the matching rule record the way a dedicated controller would.
 * Menu 264 "Stock Adjustment" covers every kind (per-kind rights later).
 *
 * No `/list` route (house rule): the list screen is grid 122
 * (TXN MAIN LIST - STOCK ADJUSTMENT) over `stock.stock_voucher` with
 * `svh_voucher_type IN (the four)`; its `kind_code` tells a re-lot and a move
 * apart. The line grid is ui_table 41.
 *
 * RIGHTS (notes 151 #1). Every route is judged on the caller's `user_menus`
 * row for menu 264, as the physical count (45) is since notes 150 #6 and
 * receipts (99) / payments (100) since notes 62: reads and the picker need
 * view, a new document create, a draft change edit, post / cancel / delete
 * their own right, and a save that also posts needs post as well. No row, no
 * rights — SUPER ADMIN included. 403 `ADJ_RIGHT_<RIGHT>`. Until this only
 * `AccessTokenGuard` ran, and `pick-stock?companyId=<another company>`
 * answered 200 "0 holdings". The company and branch on a request are NOT
 * compared with the token's: the token carries the login's home company and
 * the device's branch, and users post across companies by design (notes 150
 * #7, memory token-scope-is-home-company-and-device-branch).
 */
export const STOCK_ADJUSTMENT_MENU_ID = 264;

@ApiTags('Stock Adjustment')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock/adjustment')
@UseFilters(StockVoucherExceptionFilter)
export class StockAdjustmentController {
  constructor(
    private readonly service: StockAdjustmentService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a DRAFT adjustment, issue, damage or expiry write-off, or a stock move',
    description:
      'header.voucherType picks the kind. Every line moves under a reason (its own, else the header\'s): an IN / OUT reason fixes the sign, a BOTH reason takes it from the signed quantity. Outward lines name a lot from /pick-stock or leave it to the issue strategy; inward lines state identity. A re-lot is an ADJUSTMENT with a RELOT_OUT / RELOT_IN pair that balances per item. BUCKET_MOVE (stored as ADJUSTMENT): every line names its lot, `bucket` (from) and `toBucket` (to), a positive quantity and a move reason; the post writes BUCKET_OUT / BUCKET_IN at the same cost and no accounts voucher.',
  })
  @ApiCreatedResponse({ description: 'The saved document.' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async save(@Body() dto: SaveStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherSaveResult>> {
    await this.requireRight(dto.header.svhId ? 'edit' : 'create', 'save a stock adjustment');
    if (dto.header.post === true || dto.header.status === 'POSTED') {
      await this.requireRight('post', 'post a stock adjustment');
    }
    const data = await this.service.save(dto);
    return {
      success: true,
      message: dto.header.svhId ? 'Stock adjustment updated successfully' : 'Stock adjustment created successfully',
      data,
    };
  }

  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Load one document with item, lot, reason and godown names',
    description:
      '`kind` is what the Type selector shows: ADJUSTMENT, RELOT, BUCKET_MOVE, ISSUE, DAMAGE or EXPIRY_WRITEOFF (header.voucherType stays the stored type, ADJUSTMENT for the first three). A move\'s lines carry `toBucket`.',
  })
  @ApiOkResponse({ description: 'The document.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async load(@Query() query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockAdjustmentPayload>> {
    await this.requireRight('view', 'view stock adjustments');
    const data = await this.service.getOne(query.svhId, query.accYear, query.companyId, query.branchId);
    return { success: true, message: 'Stock adjustment fetched successfully', data };
  }

  @Get('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Preflight one document, line by line',
    description:
      'The reason and its direction, the lot and what it holds, the expiry rule, the re-lot pair, the identity facets, the freeze — one message per line, the same rules the post applies.',
  })
  @ApiOkResponse({ description: 'One row per line; problem null means clean.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async validate(@Query() query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>> {
    await this.requireRight('view', 'view stock adjustments');
    const data = await this.service.validate(query.svhId, query.accYear, query.companyId, query.branchId);
    const failing = data.filter((row) => row.problem !== null).length;
    return {
      success: true,
      message: failing ? `${failing} of ${data.length} lines have problems` : `All ${data.length} lines are clean`,
      data,
    };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post: the engine, the accounts voucher and the trail in one transaction',
    description:
      'Per-line direction and txn type from the reason; BLOCK on any holding it would drive negative; the header re-summed from the ledger; under PERPETUAL one Stock Journal voucher (DR reason ledger / CR Stock-in-Hand for stock out, the reverse for stock in, netted per ledger; a re-lot pair and a stock move post none).',
  })
  @ApiOkResponse({ description: 'The posted document with rowsPosted.' })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async post(@Body() dto: StockAdjustmentRefDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>> {
    await this.requireRight('post', 'post a stock adjustment');
    const data = await this.service.post(dto);
    return { success: true, message: `Stock adjustment posted — ${data.rowsPosted} ledger rows`, data };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel: a DRAFT moves to CANCELLED; a POSTED document is mirrored and its Stock Journal reversed',
  })
  @ApiOkResponse({ description: 'The cancelled document with rowsReversed.' })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async cancel(@Body() dto: CancelStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>> {
    await this.requireRight('cancel', 'cancel a stock adjustment');
    const data = await this.service.cancel(dto);
    return { success: true, message: `Stock adjustment cancelled — ${data.rowsReversed} reversal rows`, data };
  }

  @Delete()
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a DRAFT' })
  @ApiOkResponse({ description: 'Deleted.' })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async remove(@Query() query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>> {
    await this.requireRight('delete', 'delete a stock adjustment draft');
    const data = await this.service.remove(query.svhId, query.accYear, query.companyId, query.branchId);
    return { success: true, message: 'Stock adjustment deleted successfully', data };
  }

  @Get('pick-stock')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Pick stock from the balance — the holdings an outward line is chosen from',
    description:
      'Balance-grain rows (godown × lot × bucket) with available > 0: item, batch, expiry, MRP, the lot\'s supplier, on hand, available, the average cost and (notes 151 #8) the batch\'s sizeId / sizeName, colourId / colourName and model. With bucket=DAMAGED it is the "what goes back to which supplier" list; without bucket, every bucket, each row naming its own. `batchNo` (notes 151 #9) is the exact batch-label scan, folded as the lot key folds it; `search` stays a loose match on name, code and batch. Live, never cached.',
  })
  @ApiOkResponse({ description: 'The holdings.' })
  async pickStock(@Query() query: PickStockQueryDto): Promise<StockVoucherSuccessResponse<PickStockRow[]>> {
    await this.requireRight('view', 'pick stock for an adjustment');
    const data = await this.service.pickStock(query);
    return { success: true, message: `${data.length} holdings`, data };
  }

  /** Notes 151 #1 — the caller's `user_menus` row for menu 264, one right per route. 403 ADJ_RIGHT_<RIGHT>. */
  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: STOCK_ADJUSTMENT_MENU_ID,
      right,
      codePrefix: 'ADJ',
      action,
    });
  }
}
