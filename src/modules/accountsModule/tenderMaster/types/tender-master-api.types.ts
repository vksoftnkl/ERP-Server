export type { AccountsErrorDetail as TenderMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as TenderMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as TenderMasterSuccessResponse } from 'src/common/types/module-api.types';
export interface TenderMasterPayload {
  tndId: string;
  tndCompanyId: string;
  // NULL = the tender is available to every branch of the company.
  tndBranchId: string | null;
  tndTypeId: string;
  tndName: string;
  tndShortName: string;
  tndLedgerId: string;
  tndSettlementLedgerId: string | null;
  tndSettlementDays: number;
  tndBankAccountId: string | null;
  tndMinAmount: number;
  tndMaxAmount: number | null;
  tndDailyLimit: number | null;
  tndSurchargePerc: number;
  tndSurchargeAmount: number;
  tndSurchargeLedgerId: string | null;
  tndEditSurcharge: boolean;
  tndEditLedger: boolean;
  tndUpiVpa: string | null;
  tndUpiQrPayload: string | null;
  tndMerchantId: string | null;
  tndTerminalId: string | null;
  tndConversionRate: number;
  // NULL on the three override flags means "inherit the tender type's value" —
  // the POS resolves them against acc_tender_types at tender time.
  tndNeedsRef: boolean | null;
  tndAllowChange: boolean | null;
  tndAllowInReturn: boolean | null;
  tndOpenCashDrawer: boolean;
  tndIsDefault: boolean;
  tndDisplayPosition: number;
  tndHotkey: string | null;
  tndColour: string | null;
  // Date-only columns, emitted as YYYY-MM-DD rather than a full timestamp.
  tndEffectiveFrom: string | null;
  tndEffectiveTo: string | null;
  tndRemarks: string | null;
  tndIsActive: boolean;
  tndIsDeleted: boolean;
  tndTallyGuid: string | null;
  tndSyncDate: string | null;
  tndCreatedOn: string;
  tndCreatedBy: string | null;
  // acc_tender_master.tnd_modified_on is nullable — a row that has never been
  // updated since creation carries no modification timestamp.
  tndModifiedOn: string | null;
  tndModifiedBy: string | null;
}
