import { SaleBill, SaleBillItem, SaleChargeDetail } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
// sale_charge_detail is polymorphic — a bill's applied charges are the rows
// carrying this discriminator plus cdDocId = sbId (see ck_cd_doc_type). A bill
// IS the tax invoice, so it reuses the INVOICE discriminator rather than a new
// BILL value that ck_cd_doc_type does not allow.
export const BILL_CHARGE_DOC_TYPE = ChargeDocType.INVOICE;
// sbBillSlno is a bigint column; it is emitted as a string because JSON has no
// bigint. Leaving it a bigint makes res.json() throw AFTER the save transaction
// has committed, so the caller sees a 500 for a bill that was in fact written —
// the failure mode this Omit exists to prevent.
export type BillPayload = Omit<
  SaleBill,
  'sbCreatedOn' | 'sbModifiedOn' | 'sbBillDatetime' | 'sbSyncDate' | 'sbBillSlno'
> & {
  sbCreatedOn?: string;
  sbModifiedOn?: string | null;
  sbBillDatetime?: string;
  sbSyncDate?: string | null;
  sbBillSlno: string;
  items?: BillItemPayload[];
  charges?: BillChargePayload[];
};
export type BillItemPayload = Omit<
  SaleBillItem,
  'sbiCreatedOn' | 'sbiModifiedOn' | 'sbiSyncDate'
> & {
  sbiCreatedOn?: string;
  sbiModifiedOn?: string | null;
  sbiSyncDate?: string | null;
  // Item/unit master attributes resolved for the line's sbiItemId and
  // sbiItemUnitId. Read-only display fields, only populated on GET — the
  // create/update paths return null for them.
  sbiItemName?: string | null;
  sbiUnitName?: string | null;
  sbiDecimalCount?: number | null;
  sbiBatchConfig?: number | null;
  sbiGroupId?: string | null;
  sbiBrandId?: string | null;
  sbiSectionId?: string | null;
  sbiCategoryId?: string | null;
};
// cdVoucherNo is a bigint column; it is emitted as a string because JSON has no
// bigint (same convention as the header's sbBillSlno).
export type BillChargePayload = Omit<
  SaleChargeDetail,
  'cdCreatedOn' | 'cdModifiedOn' | 'cdSyncDate' | 'cdVoucherNo'
> & {
  cdCreatedOn?: string;
  cdModifiedOn?: string | null;
  cdSyncDate?: string | null;
  cdVoucherNo?: string | null;
};
export type BillErrorDetail = {
  field: string;
  message: string;
};
export type BillErrorResponse = {
  statusCode?: number;
  success: false;
  message: string;
  errors: BillErrorDetail[];
};
export type BillSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};
