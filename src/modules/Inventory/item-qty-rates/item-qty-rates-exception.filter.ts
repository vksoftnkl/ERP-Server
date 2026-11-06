import { Catch } from '@nestjs/common';
import { SellingPriceBulkExceptionFilter } from '../../stocks/selling-price-bulk/selling-price-bulk-exception.filter';

/**
 * Qty-wise Prices + card rate (menu 244). The card rows are
 * inventory.item_price_master writes, so their constraint SQLSTATEs
 * (ex_ipm_overlap, ck_ipm_*) are worded by Change Selling Price's filter, which
 * this is. The slab writes translate their own (uq_iqp_slab → 409
 * ITEM_QTY_PRICE_DUPLICATE, a foreign key → 400 _REFERENCE_NOT_FOUND) inside
 * ItemsQtyPriceMasterService.save, before they reach a filter; every refusal
 * this module throws itself is already the house body. A numeric overflow is
 * the house 422 VALUE_TOO_LARGE.
 */
@Catch()
export class ItemQtyRatesExceptionFilter extends SellingPriceBulkExceptionFilter {}
