import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type ItemPriceLookupSuccessResponse<T> = ModuleApiSuccessResponse<T, never, never>;
export type { InventoryErrorDetail as ItemPriceLookupErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemPriceLookupErrorResponse } from 'src/common/types/module-api.types';

/**
 * Flat, fully-resolved sale-lookup row — the port of the legacy PL/pgSQL
 * `getItemForSale` cursor onto the current UUID schema. It resolves ONE item +
 * ONE unit rate (the pricing hub `item_price_master` row) into a single row
 * carrying the effective price, tax block, and stock.
 */
export interface ItemPriceLookupPayload {
  item_id: string;
  unit_id: string;
  /** item_price_master PK (ipm_id) — the pricing hub the rate was taken from. */
  unit_rate_id: string;
  godown_id: string;
  godown_name: string;

  // Identity / naming
  item_code: string | null;
  /** Regional name (item_name_ta) when the `regional` flag is set, else the English name. */
  item_name: string;
  item_com_code: string | null;
  barcode: string | null;

  // Item flags
  allow_promo: boolean;
  add_freight: boolean;
  item_group_id: string;
  item_category_id: string | null;
  weigh_scale: boolean;
  batch_config: number;
  service_item: 'Y' | 'N';
  allow_negative_stock: boolean;

  // Pricing (effective = selected price level − customer disc qty)
  /** Selected price column: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost. */
  price_level: number;
  sales_price: number;
  cost_price: number;
  cost_wot: number;
  min_price: number;
  max_price: number;
  disc_perc: number;
  disc_qty: number;
  /** Legacy item-group price-level scheme discount — no equivalent column in the current schema, always null. */
  sch_discount: number | null;
  addl_cess: number;

  // Unit
  unit_desc: string | null;
  unit_weight: number;
  unit_loading: number;
  decimal_count: number;

  // Loyalty
  loyalty_pv: number;

  // Stock (null when no accounting year supplied)
  stock: number | null;
  reorder_qty: number | null;

  // Tax — perc fields are zeroed when the company has GST disabled
  gst_rate: number;
  cess_perc: number;
  cess_unit: number;
  sgst_perc: number;
  cgst_perc: number;
  igst_perc: number;
  sales_ledger_id: string | null;
  sgst_output_ledger_id: string | null;
  cgst_output_ledger_id: string | null;
  igst_output_ledger_id: string | null;
  cess_output_ledger_id: string | null;
}
