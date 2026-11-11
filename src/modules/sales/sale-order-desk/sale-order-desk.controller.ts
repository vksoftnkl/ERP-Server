import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, HttpCode, HttpStatus, Post, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { SaleOrderErrorResponseDto } from '../sale-order/dto/sale-order-response.dto';
import {
  CloseOpenLinesDto,
  DeliveryHoldDto,
  FiguresDto,
  MergeDto,
  MergePreviewDto,
  PriorityDto,
  StockCoverDto,
} from './dto/sale-order-desk.dto';
import { SaleOrderDeskExceptionFilter } from './sale-order-desk-exception.filter';
import { SaleOrderDeskMergeService } from './sale-order-desk-merge.service';
import { SaleOrderDeskService } from './sale-order-desk.service';
import type {
  CloseOpenLinesResult,
  DeliveryHoldResult,
  FiguresResult,
  MergePreviewResult,
  MergeResult,
  PriorityResult,
  SaleOrderDeskResponse,
  StockCoverResult,
} from './types/sale-order-desk.types';

/**
 * Sales Order Management — the order desk (menu 299; plan
 * share/sales/plan-sales-order-management-qt-2026-11-10.md + addendum-1).
 * The lists are grids 201-203 (`/configured-grid-sql/run`); these are the
 * actions. Every route is judged on the Sales Order menu (11); amounts only
 * with Receipt (menu 99) View — without it a money key is absent.
 */
@ApiTags('Sale Order Desk')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiBadRequestResponse({ type: SaleOrderErrorResponseDto })
@ApiForbiddenResponse({ type: SaleOrderErrorResponseDto })
@CacheTTL(1)
@Controller('sale-order-desk')
@UseFilters(SaleOrderDeskExceptionFilter)
export class SaleOrderDeskController {
  constructor(
    private readonly desk: SaleOrderDeskService,
    private readonly mergeService: SaleOrderDeskMergeService,
  ) {}

  @Post('delivery-hold')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Put an order on delivery hold, or release it (Sales Order Edit)',
    description:
      'Sends the state wanted (soDeliveryHold) and a reason, both ways. Writes the four ' +
      'so_delivery_hold* columns, a DELIVERY_HOLD / DELIVERY_RELEASED trail step and an audit ' +
      'row; not a save, so no revision. A held order is refused by /bills (validate / post / ' +
      'amend) and by the challans with 422 SALES_ORDER_DELIVERY_HOLD, and left out of the ' +
      "bill's open orders. 400 SALES_ORDER_REASON_REQUIRED; 403 SALES_RIGHT_EDIT; 404 " +
      'SALES_NOT_FOUND; 409 SALES_ORDER_CLOSED (not CONFIRMED / PARTIAL or nothing open), ' +
      'SALES_ORDER_HOLD_UNCHANGED (already in that state; the message says by whom and when).',
  })
  @ApiOkResponse({ description: '{ soId, soAccYear, soOrderRefno, soStatus, soDeliveryHold, …}' })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  @ApiConflictResponse({ type: SaleOrderErrorResponseDto })
  async deliveryHold(
    @Body() dto: DeliveryHoldDto,
  ): Promise<SaleOrderDeskResponse<DeliveryHoldResult>> {
    const data = await this.desk.deliveryHold(dto);
    return {
      success: true,
      message: data.soDeliveryHold
        ? `${data.soOrderRefno} put on delivery hold`
        : `${data.soOrderRefno} released from delivery hold`,
      data,
    };
  }

  @Post('priority')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set an order's priority — Quick delivery = URGENT, off = NORMAL (Sales Order Edit)",
    description:
      'Writes so_priority, a PRIORITY_CHANGED trail step and an audit row; no revision. ' +
      '400 VALIDATION_IS_IN; 403 SALES_RIGHT_EDIT; 404 SALES_NOT_FOUND; 409 SALES_ORDER_CLOSED, ' +
      'SALES_ORDER_PRIORITY_UNCHANGED.',
  })
  @ApiOkResponse({ description: '{ soId, soAccYear, soOrderRefno, soPriority }' })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  @ApiConflictResponse({ type: SaleOrderErrorResponseDto })
  async priority(@Body() dto: PriorityDto): Promise<SaleOrderDeskResponse<PriorityResult>> {
    const data = await this.desk.priority(dto);
    return {
      success: true,
      message:
        data.soPriority === 'URGENT'
          ? `${data.soOrderRefno} marked for quick delivery`
          : `${data.soOrderRefno} set to ${data.soPriority}`,
      data,
    };
  }

  @Post('close-open-lines')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel the rest of an order: close its open lines, keep the billed part (Sales Order Cancel)',
    description:
      "Releases the order's reservations, then closes every open line (cancelOrderOpenLines): " +
      'the order ends COMPLETED (something billed) or CANCELLED (nothing billed), with a ' +
      'CANCELLED step "Open lines closed: <reason>". soCancelledAmt / soPendingAmt only with ' +
      'Receipt (99) View. 400 SALES_ORDER_REASON_REQUIRED, SALE_ORDER_ADVANCE_HELD (it would ' +
      'end CANCELLED holding an advance); 403 SALES_RIGHT_CANCEL; 404 SALES_NOT_FOUND; 409 ' +
      'SALES_ORDER_CLOSED.',
  })
  @ApiOkResponse({ description: 'SaleOrderCancelLinesResult + releasedReservations' })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  @ApiConflictResponse({ type: SaleOrderErrorResponseDto })
  async closeOpenLines(
    @Body() dto: CloseOpenLinesDto,
  ): Promise<SaleOrderDeskResponse<CloseOpenLinesResult>> {
    const data = await this.desk.closeOpenLines(dto);
    return {
      success: true,
      message: `${data.cancelledLines} open line(s) closed; the order is ${data.soStatus}`,
      data,
    };
  }

  @Post('stock-cover')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'In-stock weight of the ticked orders (reads only; Sales Order View)',
    description:
      'Per item, base units: pending vs free (SALEABLE, this company and branch) + these ' +
      "orders' own open reservations; kg = open qty × unit weight. 1-500 orders; an id not " +
      'found here goes into missing[]. 400 VALIDATION_ARRAY_MIN_SIZE / _MAX_SIZE; 403 ' +
      'SALES_RIGHT_VIEW.',
  })
  @ApiOkResponse({ description: '{ orderKg, coverKg, shortKg, coverPerc, items[], missing[] }' })
  async stockCover(@Body() dto: StockCoverDto): Promise<SaleOrderDeskResponse<StockCoverResult>> {
    const data = await this.desk.stockCover(dto);
    return { success: true, message: 'Stock cover', data };
  }

  @Post('figures')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "The desk's amounts and dues (Sales Order View + Receipt View)",
    description:
      'Grids 201-203 carry no money; this is where the open values, order amounts and the ' +
      "customers' dues (DR, live, part-paid included) come from. customers = the orders' " +
      'customers ∪ custIds. listValue = Σ openValue. 403 SALES_RIGHT_VIEW, ' +
      'SALES_ORDER_MONEY_RIGHT (no Receipt menu 99 View); 400 VALIDATION_ARRAY_MAX_SIZE.',
  })
  @ApiOkResponse({ description: '{ orders[], customers[], listValue }' })
  async figures(@Body() dto: FiguresDto): Promise<SaleOrderDeskResponse<FiguresResult>> {
    const data = await this.desk.figures(dto);
    return { success: true, message: 'Order figures', data };
  }

  @Post('merge-preview')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'What a merge of these orders would make (reads only; Sales Order View)',
    description:
      'Business refusals come back in refusals[] with ok: false (as /bills/validate), plus a ' +
      'missing Create / Post / Cancel right. Only a missing View (403 SALES_RIGHT_VIEW) and ' +
      'malformed input (400) fail the call. fingerprint goes back to /merge. Amounts only ' +
      'with Receipt (99) View.',
  })
  @ApiOkResponse({ description: '{ ok, refusals[], fingerprint, customer, orders[], newOrder }' })
  async mergePreview(
    @Body() dto: MergePreviewDto,
  ): Promise<SaleOrderDeskResponse<MergePreviewResult>> {
    const data = await this.mergeService.preview(dto);
    return { success: true, message: 'Merge preview', data };
  }

  @Post('merge')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Merge 2-20 orders of one customer into a new confirmed order (Create + Post + Cancel)',
    description:
      'One transaction: the sources are locked (by so_id) and checked, the fingerprint is ' +
      're-computed, the new order is created (oldest source header, every open line at its ' +
      'pending qty, amounts pro-rata) and confirmed through /post (FEFO reservations; shortfalls ' +
      "are warnings[]), each source's reservations are released and its open lines closed " +
      '(→ CANCELLED, or COMPLETED when part-billed), and MERGED steps are written on all. Any ' +
      'refusal rolls everything back, the number included. 400 SALES_ORDER_MERGE_TOO_FEW / ' +
      '_ONE_PARTY / _TERMS_DIFFER, SALES_SALESMAN_INVALID; 403 SALES_RIGHT_CREATE / _POST / ' +
      '_CANCEL; 404 SALES_NOT_FOUND; 409 SALES_ORDER_CLOSED, SALES_ORDER_DELIVERY_HOLD, ' +
      'SALES_ORDER_MERGE_ADVANCE / _CHARGES / _SOURCE_CHANGED, SALES_DAY_CLOSED, ' +
      'SALE_ORDER_ORDER_NO_TAKEN. soOrderAmt only with Receipt (99) View.',
  })
  @ApiOkResponse({ description: 'the new order keys + totals + warnings[] + mergedSources[]' })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  @ApiConflictResponse({ type: SaleOrderErrorResponseDto })
  async merge(@Body() dto: MergeDto): Promise<SaleOrderDeskResponse<MergeResult>> {
    const { message, data } = await this.mergeService.merge(dto);
    return { success: true, message, data };
  }
}
