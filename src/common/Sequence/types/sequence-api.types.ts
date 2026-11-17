import type { SequenceErrorCode } from './sequence-error-codes';

export interface SequenceErrorDetail {
  field: string;
  message: string;
  code: SequenceErrorCode;
  /** Fills the `{name}` placeholders of the code's wording row (notes 120). */
  params?: Record<string, string>;
  /**
   * Picks a wording variant `rule=<value>` of the code's row (notes 120): on
   * SEQUENCE_REFNO_TOO_LONG, 'GST16' when a GST outward number passes 16 characters,
   * 'GST16_DEVICE' / 'GST16_CHARS' for a challan-type number (SequenceRefusalRule).
   */
  rule?: string;
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
  /**
   * True when this row is a device's ONE series for every branch of the company (a device-wide
   * type, user 11-16 "one series per PC"): `branchId` is then only the anchor it is filed under.
   */
  allBranches: boolean;
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
