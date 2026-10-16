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
  /** Every type but RRN / TEMP_CR / CREDIT / LOYALTY names the ledger its money sits in. */
  LEDGER_REQUIRED = 'TENDER_LEDGER_REQUIRED',
  // Notes 128 §2 — the wrong ledger for the type, one code per rule (was one
  // TENDER_LEDGER_TYPE), so the client can say which ledger the type wants.
  /** A CASH tender on a ledger that is not CASH (led_ledger_type, Cash-in-Hand). */
  CASH_LEDGER_NOT_CASH = 'TENDER_CASH_LEDGER_NOT_CASH',
  /** A CARD / UPI / WALLET tender on a CASH or BANK ledger: it wants a clearing ledger. */
  CLEARING_LEDGER_IS_MONEY = 'TENDER_CLEARING_LEDGER_IS_MONEY',
  /** A BANK tender on a ledger that is not BANK (Bank Accounts). */
  BANK_LEDGER_NOT_BANK = 'TENDER_BANK_LEDGER_NOT_BANK',
  /** A CHEQUE tender on a CASH or BANK ledger: a received cheque sits in Cheques In Hand. */
  CHEQUE_LEDGER_IS_MONEY = 'TENDER_CHEQUE_LEDGER_IS_MONEY',
  /** An RRN / TEMP_CR / CREDIT / LOYALTY tender given a ledger: those post no tender leg. */
  LEDGER_NOT_ALLOWED = 'TENDER_LEDGER_NOT_ALLOWED',
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
