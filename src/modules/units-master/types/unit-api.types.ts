export interface UnitErrorDetail {
  field: string;
  message: string;
}

export interface UnitErrorResponse {
  success: false;
  message: string;
  errors: UnitErrorDetail[];
}

export interface UnitSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface UnitPayload {
  unit_id: string;
  unit_name: string;
  unit_alias: string | null;
  unit_code: string | null;
  unit_description: string | null;
  unit_decimal_count: number;
  unit_weight: number | null;
  unit_loading: number | null;
  unit_unloading: number | null;
  unit_attach_charge: number | null;
  unit_is_pack_unit: boolean;
  unit_base_unit_id: string | null;
  unit_conversion: number | null;
  unit_is_active: boolean;
  unit_is_deleted: boolean;
  unit_sync_date: string | null;
  unit_created_on: string;
  unit_created_by: string | null;
  unit_modified_on: string;
  unit_modified_by: string | null;
}

export type UnitListItem = UnitPayload | Record<string, unknown>;

export interface UnitListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
