export type { InventoryErrorDetail as TaxRateErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as TaxRateErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as TaxRateSuccessResponse } from 'src/common/types/module-api.types';

/**
 * One ledger override — a (role, supply nature) pair that posts somewhere other
 * than where accounts.acc_ledger_map would send it.
 *
 * `trl_role_label` and `trl_ledger_name` are resolved on the read paths so a
 * grid can render the row without a second round-trip. They are read-only:
 * ignored on write, and null on the rows echoed back by /create and /delete.
 */
export interface TaxRateLedgerPayload {
  trl_id: string;
  trl_tax_id: string;
  trl_role: string;
  trl_role_label?: string | null;
  trl_supply_nature: string | null;
  trl_ledger_id: string;
  trl_ledger_name?: string | null;
  trl_remarks: string | null;
  trl_is_active: boolean;
  trl_is_deleted: boolean;
  trl_sync_date: string | null;
  trl_created_on: string;
  trl_created_by: string | null;
  trl_modified_on: string | null;
  trl_modified_by: string | null;
}

/**
 * A GST rate, whole: the header plus the ledger overrides it carries.
 *
 * `tax_cgst_perc` / `tax_sgst_perc` / `tax_igst_perc` are GENERATED columns —
 * they come back computed from tax_rate_perc and are rejected on write, so a
 * screen can display them but never send them.
 */
export interface TaxRatePayload {
  tax_id: string;
  tax_name: string;
  tax_code: string | null;
  tax_sort_order: number;
  tax_taxability: string;
  tax_is_reverse_charge: boolean;
  tax_rate_perc: number;
  tax_cgst_perc: number | null;
  tax_sgst_perc: number | null;
  tax_igst_perc: number | null;
  tax_cess_basis: string;
  tax_cess_perc: number;
  tax_cess_per_unit: number;
  tax_acess_basis: string;
  tax_acess_perc: number;
  tax_acess_per_unit: number;
  tax_supersedes_id: string | null;
  tax_supersedes_name?: string | null;
  tax_is_active: boolean;
  tax_is_deleted: boolean;
  tax_sync_date: string | null;
  tax_created_on: string;
  tax_created_by: string | null;
  tax_modified_on: string | null;
  tax_modified_by: string | null;
  lines: TaxRateLedgerPayload[];
}

export interface TaxRateDeleteResult {
  tax_id: string;
  deleted: boolean;
  /** How many live ledger overrides went down with the header. */
  lines_deleted: number;
}

/**
 * One role and the ledger it actually resolves to for a given rate — the answer
 * accounts.fn_ledger_for gives, made visible.
 *
 * `source` is the point of it: OVERRIDE means this rate carries a row of its
 * own, DEFAULT means it inherits accounts.acc_ledger_map, and UNMAPPED means
 * nothing answers and a voucher touching this role cannot be posted yet.
 */
export interface TaxRateResolvedLedger {
  role: string;
  role_label: string;
  role_group: string;
  /** The nature asked for, echoed back — null when the question was neutral. */
  supply_nature: string | null;
  ledger_id: string | null;
  ledger_name: string | null;
  source: 'OVERRIDE' | 'DEFAULT' | 'UNMAPPED';
  /** trl_id or alm_id — the row that answered. Null when nothing did. */
  source_row_id: string | null;
}

/** GET /resolve — the rate, and every role it can influence, resolved. */
export interface TaxRateResolution {
  tax_id: string;
  tax_name: string;
  supply_nature: string | null;
  roles: TaxRateResolvedLedger[];
}
