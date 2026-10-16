export type { AccountsErrorDetail as TenderMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as TenderMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as TenderMasterSuccessResponse } from 'src/common/types/module-api.types';
import type { AccountsErrorDetail } from 'src/common/types/module-api.types';

/**
 * Every refusal Tender Master raises (notes 119 / 127 §5) — the tender ↔ ledger
 * fit of notes 126 (judged once, when the master is saved) and the rest. The Qt
 * client words its box by the code alone: each string is an API contract.
 */
export enum TenderMasterErrorCode {
  /** Every type but TEMP_CR / CREDIT / LOYALTY names the ledger its money sits in. */
  LEDGER_REQUIRED = 'TENDER_LEDGER_REQUIRED',
  /** The ledger is the wrong kind for the type (CARD on a bank, CASH off Cash-in-Hand …). */
  LEDGER_TYPE = 'TENDER_LEDGER_TYPE',
  /** A posting / settlement / surcharge ledger id names no live account ledger. */
  LEDGER_NOT_FOUND = 'TENDER_LEDGER_NOT_FOUND',
  /** No live (not deleted) tender has the tndId given (404). */
  NOT_FOUND = 'TENDER_NOT_FOUND',
  /** tndCompanyId names no live company. */
  COMPANY_NOT_FOUND = 'TENDER_COMPANY_NOT_FOUND',
  /** tndBranchId names no live branch. */
  BRANCH_NOT_FOUND = 'TENDER_BRANCH_NOT_FOUND',
  /** tndTypeId names no live tender type. */
  UNKNOWN_TYPE = 'TENDER_UNKNOWN_TYPE',
  /** tndTypeId is not a whole number that fits the 32-bit type id. */
  BAD_TYPE_ID = 'TENDER_BAD_TYPE_ID',
  /** tndBankAccountId names no live ledger bank account. */
  BANK_ACCOUNT_NOT_FOUND = 'TENDER_BANK_ACCOUNT_NOT_FOUND',
  /** Another live tender of this company / branch already has this name (409). */
  NAME_TAKEN = 'TENDER_NAME_TAKEN',
  /** Another live tender of this company / branch already has this short name (409). */
  SHORT_NAME_TAKEN = 'TENDER_SHORT_NAME_TAKEN',
  /** Another live tender of this company / branch already uses this hotkey (409). */
  HOTKEY_TAKEN = 'TENDER_HOTKEY_TAKEN',
  /** This company / branch already has an active default tender (409). */
  DEFAULT_TAKEN = 'TENDER_DEFAULT_TAKEN',
  /** A unique index (name, short name, hotkey, default) refused the save (409). */
  DUPLICATE = 'TENDER_DUPLICATE',
  /** tndMaxAmount is below tndMinAmount. */
  AMOUNT_RANGE = 'TENDER_AMOUNT_RANGE',
  /** tndEffectiveTo is before tndEffectiveFrom. */
  DATE_RANGE = 'TENDER_DATE_RANGE',
  /** An effective date is not a valid ISO date. */
  DATE_INVALID = 'TENDER_DATE_INVALID',
  /** An amount field is not a finite number. */
  NUMBER_INVALID = 'TENDER_NUMBER_INVALID',
}

export interface TenderMasterCodedErrorDetail extends AccountsErrorDetail {
  code: TenderMasterErrorCode;
}
export interface TenderMasterPayload {
  tndId: string;
  tndCompanyId: string;
  // NULL = the tender is available to every branch of the company.
  tndBranchId: string | null;
  tndTypeId: string;
  tndName: string;
  tndShortName: string;
  /** Null only on TEMP_CR / CREDIT / LOYALTY (notes 126 §5). */
  tndLedgerId: string | null;
  tndSettlementLedgerId: string | null;
  // Read-only display names resolved for the id columns above. Only the GET
  // path joins the masters, so create/update/delete return null for all of
  // them; a null on GET means the id itself is null.
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
  tndSyncDate: string | null;
  tndCreatedOn: string;
  tndCreatedBy: string | null;
  // acc_tender_master.tnd_modified_on is nullable — a row that has never been
  // updated since creation carries no modification timestamp.
  tndModifiedOn: string | null;
  tndModifiedBy: string | null;
}
