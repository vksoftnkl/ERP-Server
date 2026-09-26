// Allowed-value validation for accounts.acc_ledger_master GST party registration
// type and opening-balance Dr/Cr lives here in the app layer. The equivalent native
// Postgres enum types (accounts."LedGstPartyRegType", accounts."LedObType") were
// dropped in migration 20260623110000_move_acc_ledger_enums_to_app_layer.
export enum LedGstPartyRegType {
  REGULAR = 'REGULAR',
  COMPOSITION = 'COMPOSITION',
  UNREGISTERED = 'UNREGISTERED',
}

export enum LedObType {
  DR = 'DR',
  CR = 'CR',
}

// ── The CHECK-backed vocabularies ───────────────────────────────────────────
// These five columns DO have live DB CHECK constraints (chk_led_ledger_type,
// chk_led_gst_duty_head, chk_led_msme_type, chk_led_rounding_method,
// chk_led_type_of_supply), and until now the DTO validated none of them: it
// typed them as plain strings, so a bad value reached Postgres and came back as
// a raw 23514 — a 500 with an empty `errors` array, the one response on this
// endpoint that told you nothing. Every member below is copied EXACTLY from the
// constraint, including case: the CHECK is case-sensitive, so 'goods' is a
// violation and 'Goods' is not.
export enum LedLedgerType {
  PARTY = 'PARTY',
  BANK = 'BANK',
  CASH = 'CASH',
  TAX = 'TAX',
  ROUNDOFF = 'ROUNDOFF',
  DISCOUNT = 'DISCOUNT',
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  GENERAL = 'GENERAL',
}

export enum LedGstDutyHead {
  CENTRAL_TAX = 'Central Tax',
  STATE_TAX = 'State Tax',
  INTEGRATED_TAX = 'Integrated Tax',
  CESS = 'Cess',
  STATE_CESS = 'State Cess',
}

export enum LedMsmeType {
  MICRO = 'Micro',
  SMALL = 'Small',
  MEDIUM = 'Medium',
}

export enum LedRoundingMethod {
  NOT_APPLICABLE = 'Not Applicable',
  UPWARD = 'Upward',
  DOWNWARD = 'Downward',
  NORMAL = 'Normal',
}

export enum LedTypeOfSupply {
  GOODS = 'Goods',
  SERVICES = 'Services',
}

// GST input tax credit eligibility (chk_led_itc_eligibility, 20260917120000).
// Tally's own list under the ledger's GST details. Without it GSTR-3B table
// 4(D) "Ineligible ITC" cannot be produced and 4(A) is overstated by every
// blocked s.17(5) credit — motor vehicles, food and beverage, works contract,
// personal consumption.
export enum LedItcEligibility {
  ELIGIBLE = 'ELIGIBLE',
  INELIGIBLE_17_5 = 'INELIGIBLE_17_5',
  INELIGIBLE_OTHER = 'INELIGIBLE_OTHER',
  CAPITAL_GOODS = 'CAPITAL_GOODS',
  INPUT_SERVICES = 'INPUT_SERVICES',
}

// Allowed-value validation for the nested ledger bank account `lbaAccountType`.
// The acc_ledger_bank_accounts.lba_account_type column is a plain VarChar(20)
// (no native Postgres enum), so this is enforced in the app layer only.
export enum BankAccountType {
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
  CASH_CREDIT = 'CASH_CREDIT',
  OVERDRAFT = 'OVERDRAFT',
}
