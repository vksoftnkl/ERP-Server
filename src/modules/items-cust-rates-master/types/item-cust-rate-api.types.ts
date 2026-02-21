export interface ItemCustRateErrorDetail {
  field: string;
  message: string;
}

export interface ItemCustRateErrorResponse {
  success: false;
  message: string;
  errors: ItemCustRateErrorDetail[];
}

export interface ItemCustRateSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface ItemCustRateListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
