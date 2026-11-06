import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GetItemQtyRatesQueryDto } from './dto/get-item-qty-rates-query.dto';
import { QtyRatesSaveSuccessDto, QtyRatesViewSuccessDto } from './dto/item-qty-rates-response.dto';
import { SaveItemQtyRatesDto } from './dto/save-item-qty-rates.dto';
import { ItemQtyRatesExceptionFilter } from './item-qty-rates-exception.filter';
import { ItemQtyRatesService } from './item-qty-rates.service';
import type { QtyRatesSaveResult, QtyRatesView } from './types/item-qty-rates.types';

interface QtyRatesSuccess<TData> {
  success: true;
  message: string;
  data: TData;
}

/**
 * Qty-wise Prices + Cost + Card Rate — one form, one Save (menu 244, plan
 * 2026-11-05 §4.1 / §4.2). The route family D1 names, beside the slab master's
 * own create / get / delete / restore (a different controller and module).
 *
 * NOT cached: live prices and slabs, judged per user's rights and per company
 * (the HTTP cache key ignores both).
 */
@ApiTags('Item Qty Prices')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto })
@Controller('item-qty-prices')
@UseFilters(ItemQtyRatesExceptionFilter)
export class ItemQtyRatesController {
  constructor(private readonly service: ItemQtyRatesService) {}

  @Get('get-with-rates')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "One item's cost + card rate (this branch, today) and its qty slabs, for menu 244",
    description:
      "item: eligibility by Cost Price – Bulk Change's rule (plainStock, trackedAs, leftOutReason), " +
      'groupName / brandName (null when none). ' +
      'rights: menu 244 view / createSlab / editSlab / deleteSlab, menu 30 editCard, allBranchSlab ' +
      '(HQ user type). levels: the ACTIVE price levels 1–4 (fixed.price_levels). units: the ' +
      '/stock/price-bulk grid rows of the item (one per active unit × live bucket, the headline ' +
      'when the item tracks none) plus the unit chain (parentUomId, unitsPerParent, factorsAgree), ' +
      "the answering row's own cost (rowCost / rowCostWot) beside the stock average (stockAvg), " +
      'cardCost (what the Cost column shows and slabs are judged by), profitType, costEditable / ' +
      'mrpEditable (Plain-stock headline row with menu 30 EDIT) and scheduledFrom. slabs: every ' +
      'live slab of the item, all scopes, as /item-qty-prices/get answers them. 403 ' +
      'ITEM_QTY_PRICE_RIGHT_VIEW without menu 244 VIEW; 404 LOOKUP_ITEM_NOT_FOUND for an item not ' +
      'there at this company and branch.',
  })
  @ApiOkResponse({ type: QtyRatesViewSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async getWithRates(
    @Query() query: GetItemQtyRatesQueryDto,
  ): Promise<QtyRatesSuccess<QtyRatesView>> {
    const data = await this.service.getWithRates(query);
    return {
      success: true,
      message: `${data.units.length} card row${data.units.length === 1 ? '' : 's'}, ${data.slabs.length} slab${data.slabs.length === 1 ? '' : 's'}`,
      data,
    };
  }

  @Post('save-with-rates')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save the card rows, the slabs and the slab deletes in ONE transaction',
    description:
      'Rights first (403): menu 244 VIEW; CREATE for a slab without iqp_id, EDIT with one, DELETE ' +
      'for deleteSlabIds; menu 30 EDIT for any rates.rows (STOCK_PRICE_RIGHT_EDIT). Shape: nothing ' +
      'to save 400 ITEM_QTY_PRICE_NOTHING_TO_SAVE; a slab of another item 400 _ITEM_MISMATCH; an id ' +
      'twice 400 VALIDATION_ARRAY_UNIQUE; a level not blank / active 1–4 422 _LEVEL_NOT_SELLING; a ' +
      'slab for all branches from a non-HQ user type 403 _CHAIN_HQ_ONLY; a non-HQ user type ' +
      'saving or deleting a slab of another branch than the one it logged in at 403 ' +
      '_OTHER_BRANCH. Every slab refusal is filed under slabs.<i>.<field>. A card row judges ' +
      'only its active levels priced above 0; a costPrice equal to the stored cost at 2 decimals ' +
      'is unchanged (the stored cost and w/o tax are kept). Then, nothing written: ' +
      'costPrice / maxPrice on an item that is not Plain stock 422 _COST_NOT_PLAIN_STOCK / ' +
      "_MRP_NOT_PLAIN_STOCK; Change Selling Price's checks (422 STOCK_PRICE_*); a headline's prices " +
      'above its MRP after the save 422 ITEM_QTY_PRICE_ABOVE_MRP; every live slab in force today or ' +
      'later at this company / branch judged against the card after the save — zero or less, above ' +
      'MRP, below Min refuse (422), below cost by inventory.below_cost_price (restrict 422, warning ' +
      'asks, allow reports); a By User unit whose cost changed and prices did not asks. A refusal ' +
      'answers 422 with errors[] and problems[]; an ask answers 200 needsConfirm with problems[] ' +
      '(re-post with confirmed: true). Then deletes, the card (this branch, from today, logged ' +
      'CHANGE_SELLING_PRICE "via Qty-wise Prices (menu 244)"), the slabs; a slab overlap (409 ' +
      'ITEM_QTY_PRICE_OVERLAP) rolls everything back.',
  })
  @ApiOkResponse({ type: QtyRatesSaveSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  async saveWithRates(
    @Body() dto: SaveItemQtyRatesDto,
  ): Promise<QtyRatesSuccess<QtyRatesSaveResult>> {
    const data = await this.service.saveWithRates(dto);
    return { success: true, message: this.service.buildSaveMessage(data), data };
  }
}
