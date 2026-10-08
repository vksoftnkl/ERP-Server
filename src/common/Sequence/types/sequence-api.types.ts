export interface SequenceErrorDetail {
  field: string;
  message: string;
}

export interface SequenceErrorResponse {
  success: false;
  message: string;
  errors: SequenceErrorDetail[];
}

export interface SequenceSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface SequencePayload {
  id: string;
  vchrTypeId: number;
  companyId: string;
  branchId: string;
  accYear: string;
  deviceId: string | null;
  deviceCode: string;
  periodKey: string;
  lastNo: string;
  voucherPrefix: string | null;
  companyCode: string | null;
  branchCode: string | null;
  voucherSuffix: string | null;
  noWidth: number;
  lastRefno: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdOn: string;
  createdBy: string | null;
  modifiedOn: string | null;
  modifiedBy: string | null;
}

export type SequenceListItem = SequencePayload;

export interface SequenceListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface SequenceListResult {
  items: SequenceListItem[];
  meta: SequenceListMeta;
}
