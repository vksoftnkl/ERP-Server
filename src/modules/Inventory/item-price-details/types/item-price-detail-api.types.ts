import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type ItemPriceDetailSuccessResponse<T> = ModuleApiSuccessResponse<T, never, never>;
import { ItemPayload } from '../../items-master/types/item-api.types';
import { ItemPricePayload } from '../../items-price-master/types/item-price-api.types';
import { ItemUnitConversionPayload } from '../../item-unit-conversion/types/item-unit-conversion-api.types';
export type { InventoryErrorDetail as ItemPriceDetailErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemPriceDetailErrorResponse } from 'src/common/types/module-api.types';
/**
 * The item's default tax, read from `inventory.tax_rate_master` — where
 * `item_default_tax_id` has pointed since
 * 20260912110000_repoint_items_to_tax_rate_master. The field names are the ones
 * the old `item_tax_master` payload used, kept so the client reads this block
 * unchanged; what feeds each one is noted where the two tables differ.
 */
export interface ItemPriceDetailTaxPayload {
  tax_id: string;
  tax_name: string;
  tax_code: string | null;
  /** tax_taxability: TAXABLE | EXEMPT | NIL_RATED | NON_GST | ZERO_RATED. */
  tax_taxability_type: string;
  tax_is_reverse_charge: boolean;
  /** GENERATED from tax_rate_perc on the rate (half, half, whole). */
  tax_cgst_perc: number;
  tax_sgst_perc: number;
  tax_igst_perc: number;
  /**
   * A rate carries ONE percentage for sales and purchase alike, so the three
   * `_pur_` figures repeat the sales ones above.
   */
  tax_cgst_pur_perc: number;
  tax_sgst_pur_perc: number;
  tax_igst_pur_perc: number;
  /**
   * tax_cess_basis: NONE | PERCENT | PER_UNIT | BOTH. The old table said UNIT
   * where this says PER_UNIT, and had no BOTH — a caller comparing against
   * 'UNIT' must test for PER_UNIT or BOTH instead.
   */
  tax_cess_type: string;
  /** tax_cess_perc — non-zero only when the basis is PERCENT or BOTH. */
  tax_cess_perc: number;
  /** tax_cess_per_unit — non-zero only when the basis is PER_UNIT or BOTH. */
  tax_cess_unit: number;
  /** One cess for both sides, as with the GST figures: repeats tax_cess_perc. */
  tax_cess_pur_perc: number;
  /** Repeats tax_cess_unit. */
  tax_cess_pur_unit: number;
  /** tax_rate_perc — the total GST rate (18 means 18%). */
  tax_gst_rate_total: number;
  /**
   * Always null. A rate carries no ledger columns: a role resolves through
   * accounts.acc_ledger_map, overridden per rate by inventory.tax_rate_ledger
   * (GET /tax-rates/resolve).
   */
  tax_sales_ledger_id: null;
  tax_sales_return_ledger_id: null;
  tax_purchase_ledger_id: null;
  tax_purchase_return_ledger_id: null;
  tax_cgst_output_ledger_id: null;
  tax_sgst_output_ledger_id: null;
  tax_igst_output_ledger_id: null;
  tax_cess_output_ledger_id: null;
  tax_cgst_input_ledger_id: null;
  tax_sgst_input_ledger_id: null;
  tax_igst_input_ledger_id: null;
  tax_cess_input_ledger_id: null;
  tax_is_active: boolean;
  tax_is_deleted: boolean;
  tax_sync_date: string | null;
  tax_created_on: string;
  tax_created_by: string | null;
  /** Null on a rate that has never been edited. */
  tax_modified_on: string | null;
  tax_modified_by: string | null;
}
export interface ItemPriceDetailPayload {
  item: ItemPayload;
  item_prices: ItemPricePayload[];
  /**
   * The item's live unit conversions, returned alongside the prices because a
   * price row only points at one (ipm_uc_unit_id -> iuc_id) and carries none of
   * its shape. Callers that convert quantities or build unit pickers join the
   * two here instead of making a second round trip.
   */
  item_unit_conversions: ItemUnitConversionPayload[];
  item_tax: ItemPriceDetailTaxPayload | null;
}
