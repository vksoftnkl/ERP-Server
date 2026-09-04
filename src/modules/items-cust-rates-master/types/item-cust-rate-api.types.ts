import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type ItemCustRateErrorDetail = ModuleApiErrorDetail;
export type ItemCustRateErrorResponse = ModuleApiErrorResponse<ItemCustRateErrorDetail>;
export type ItemCustRateSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type ItemCustRateListMeta = ModuleListMeta;

export interface ItemCustRatePayload {
  csr_id: string;
  csr_branch_id: string | null;
  csr_customer_id: string;
  csr_unit_rate_id: string;
  csr_rate_type: string;
  csr_item_rate: number;
  csr_disc_perc: number;
  csr_disc_qty: number;
  csr_price_level: string | null;
  csr_valid_from: string | null;
  csr_valid_to: string | null;
  csr_priority: number;
  csr_is_active: boolean;
  csr_is_deleted: boolean;
  csr_created_on: string;
  csr_created_by: string | null;
  csr_modified_on: string;
  csr_modified_by: string | null;
  csr_uploaded_at: string | null;
  csr_uploaded_by: string | null;
  csr_remarks: string | null;
}

export type ItemCustRateListItem = ItemCustRatePayload | Record<string, unknown>;

