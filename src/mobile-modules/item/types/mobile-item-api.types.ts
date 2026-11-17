/** GET /mobile/items/options: everything the order screen picks from, in one call. */
export interface MobileItemOptions {
  /** Active, live companies: replaces the phone's test companies. */
  companies: MobileCompanyOption[];
  itemGroups: MobileSortedOption[];
  brands: MobileSortedOption[];
  /**
   * Active selling levels, without Cost (7): the phone carries no cost price.
   * id 1-4 price from priceA-priceD, 5 (MRP) from mrp, 6 (minimum) from minPrice.
   */
  priceLevels: MobilePriceLevelOption[];
}

export interface MobileCompanyOption {
  id: string;
  name: string;
  /** comp_city. */
  place: string | null;
}

export interface MobileSortedOption {
  id: string;
  name: string;
  /** The master's sort order (itg_sort / brand_sort); null = unsorted, after the sorted ones. */
  position: number | null;
}

export interface MobilePriceLevelOption {
  id: number;
  name: string;
}

/** One unit an item can be ordered in, priced as /master-lookups/item-price prices it. */
export interface MobileItemUnit {
  /** item_unit_conversion.iuc_id: what soi_item_unit_id holds. */
  iucId: string;
  unitId: string;
  unitName: string | null;
  /** iuc_to_base_factor: qty in this unit × factor = qty in the base unit. */
  factor: number;
  isDefaultUnit: boolean;
  isBaseUnit: boolean;
  /** iuc_uom_weight, per unit (0 = not set). */
  weight: number;
  /**
   * Whether a live price row prices this unit today. false = every price
   * below is null and the phone should not offer the unit at a price.
   */
  priced: boolean;
  /** Selling prices of levels 1-4 (A-D), two decimals as text. */
  priceA: string | null;
  priceB: string | null;
  priceC: string | null;
  priceD: string | null;
  /** ipm_max_price: the MRP (price level 5). */
  mrp: string | null;
  /** ipm_min_price: the lowest the line may sell at (price level 6). */
  minPrice: string | null;
  /** Per unit, from the price row (ipm_loading_charge / ipm_freight_charge). */
  loadingCharge: string | null;
  freightCharge: string | null;
  /** MASTER = the unit's headline row; BUCKET = an MRP bucket (the item is priced only per MRP). */
  priceSource: 'MASTER' | 'BUCKET' | null;
  /** BRANCH = the branch's own override row; CHAIN = the row every branch shares. */
  priceScope: 'BRANCH' | 'CHAIN' | null;
  /**
   * Saleable stock free to sell in the company (all branches and godowns:
   * on hand − reserved), in THIS unit (base qty ÷ factor), 3 decimals.
   */
  availableQty: number;
}

/** One orderable item of GET /mobile/items/list. */
export interface MobileItem {
  itemId: string;
  itemCode: string | null;
  itemNameEn: string;
  itemNameTa: string | null;
  itemGroupId: string;
  itemGroupName: string | null;
  itemBrandId: string | null;
  itemBrandName: string | null;
  allowLoading: boolean;
  allowFreight: boolean;
  allowPromo: boolean;
  /** Whether the stored prices include tax (item_incl_tax). */
  inclTax: boolean;
  hsnCode: string | null;
  /** tax_rate_master id of the item's default tax. */
  taxId: string | null;
  /** The GST rate, 0 when the company is not GST applicable. Three decimals as text. */
  taxPerc: string;
  /** Saleable stock free to sell in the company, in the BASE unit. */
  availableBaseQty: number;
  units: MobileItemUnit[];
}

export interface MobileItemListPayload {
  items: MobileItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  companyId: string;
  /**
   * The branch the prices are for: the phone's own branch when deviceUid was
   * sent and it belongs to the company, else the company's default branch.
   * null = none could be chosen: rows of every branch are read, as
   * /master-lookups/item-price does with no branch_id.
   */
  branchId: string | null;
  /** The day prices were read for (the database's today, IST). */
  priceDate: string;
}
