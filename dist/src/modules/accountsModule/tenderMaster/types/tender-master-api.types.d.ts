export type { AccountsErrorDetail as TenderMasterErrorDetail } from "../../../../common/types/module-api.types";
export type { AccountsErrorResponse as TenderMasterErrorResponse } from "../../../../common/types/module-api.types";
export type { AccountsSuccessResponse as TenderMasterSuccessResponse } from "../../../../common/types/module-api.types";
import type { AccountsErrorDetail } from "../../../../common/types/module-api.types";
export declare enum TenderMasterErrorCode {
    LEDGER_REQUIRED = "TENDER_LEDGER_REQUIRED",
    LEDGER_TYPE = "TENDER_LEDGER_TYPE",
    LEDGER_NOT_FOUND = "TENDER_LEDGER_NOT_FOUND",
    NOT_FOUND = "TENDER_NOT_FOUND",
    COMPANY_NOT_FOUND = "TENDER_COMPANY_NOT_FOUND",
    BRANCH_NOT_FOUND = "TENDER_BRANCH_NOT_FOUND",
    UNKNOWN_TYPE = "TENDER_UNKNOWN_TYPE",
    BAD_TYPE_ID = "TENDER_BAD_TYPE_ID",
    BANK_ACCOUNT_NOT_FOUND = "TENDER_BANK_ACCOUNT_NOT_FOUND",
    NAME_TAKEN = "TENDER_NAME_TAKEN",
    SHORT_NAME_TAKEN = "TENDER_SHORT_NAME_TAKEN",
    HOTKEY_TAKEN = "TENDER_HOTKEY_TAKEN",
    DEFAULT_TAKEN = "TENDER_DEFAULT_TAKEN",
    DUPLICATE = "TENDER_DUPLICATE",
    AMOUNT_RANGE = "TENDER_AMOUNT_RANGE",
    DATE_RANGE = "TENDER_DATE_RANGE",
    DATE_INVALID = "TENDER_DATE_INVALID",
    NUMBER_INVALID = "TENDER_NUMBER_INVALID"
}
export interface TenderMasterCodedErrorDetail extends AccountsErrorDetail {
    code: TenderMasterErrorCode;
}
export interface TenderMasterPayload {
    tndId: string;
    tndCompanyId: string;
    tndBranchId: string | null;
    tndTypeId: string;
    tndName: string;
    tndShortName: string;
    tndLedgerId: string | null;
    tndSettlementLedgerId: string | null;
    tndCompanyName: string | null;
    tndBranchName: string | null;
    tndTypeName: string | null;
    tndLedgerName: string | null;
    tndSurchargeLedgerName: string | null;
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
    tndNeedsRef: boolean | null;
    tndAllowChange: boolean | null;
    tndAllowInReturn: boolean | null;
    tndOpenCashDrawer: boolean;
    tndIsDefault: boolean;
    tndDisplayPosition: number;
    tndHotkey: string | null;
    tndColour: string | null;
    tndEffectiveFrom: string | null;
    tndEffectiveTo: string | null;
    tndRemarks: string | null;
    tndIsActive: boolean;
    tndIsDeleted: boolean;
    tndSyncDate: string | null;
    tndCreatedOn: string;
    tndCreatedBy: string | null;
    tndModifiedOn: string | null;
    tndModifiedBy: string | null;
}
