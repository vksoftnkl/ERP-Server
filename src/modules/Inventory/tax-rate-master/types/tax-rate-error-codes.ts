/**
 * Notes 119 / 127 §5 — every refusal of the tax rate master (and of the guards
 * in tax-rate-master/utils) carries one of these as `errors[].code`; the client
 * words its message box by the code alone. Never reuse a code for a different
 * meaning.
 */
export enum TaxRateErrorCode {
  /** No live tax rate has the tax_id given. */
  NOT_FOUND = 'TAX_RATE_NOT_FOUND',
  /** tax_supersedes_id names no live tax rate. */
  SUPERSEDED_NOT_FOUND = 'TAX_RATE_SUPERSEDED_NOT_FOUND',
  /** A grid line's trl_id is not a live ledger line of this rate. */
  LINE_NOT_FOUND = 'TAX_RATE_LINE_NOT_FOUND',
  /** supply_nature / trl_supply_nature is neither of the supply natures (INTRA, INTER). */
  SUPPLY_NATURE_INVALID = 'TAX_RATE_SUPPLY_NATURE_INVALID',
  /** tax_name is missing or blank. */
  NAME_REQUIRED = 'TAX_RATE_NAME_REQUIRED',
  /** tax_taxability is not one of the known taxabilities. */
  TAXABILITY_INVALID = 'TAX_RATE_TAXABILITY_INVALID',
  /** tax_rate_perc is below 0 or above the maximum rate. */
  PERC_OUT_OF_RANGE = 'TAX_RATE_PERC_OUT_OF_RANGE',
  /** tax_cess_basis / tax_acess_basis is not one of the known cess bases. */
  CESS_BASIS_INVALID = 'TAX_RATE_CESS_BASIS_INVALID',
  /** A cess / additional cess percentage or per-unit figure is negative. */
  CESS_NEGATIVE = 'TAX_RATE_CESS_NEGATIVE',
  /** A cess / additional cess figure disagrees with its basis (set when it must be 0, or 0 when it must be > 0). */
  CESS_BASIS_MISMATCH = 'TAX_RATE_CESS_BASIS_MISMATCH',
  /** An exempt / nil-rated / non-GST rate charges a rate or cess — all must be 0. */
  EXEMPT_NOT_ZERO = 'TAX_RATE_EXEMPT_NOT_ZERO',
  /** Another live tax rate already has this name. */
  NAME_TAKEN = 'TAX_RATE_NAME_TAKEN',
  /** Another live tax rate already has this code. */
  CODE_TAKEN = 'TAX_RATE_CODE_TAKEN',
  /** The database refused a duplicate (a racing save beat the app-side name / code / line checks). */
  DUPLICATE = 'TAX_RATE_DUPLICATE',
  /** The database refused a write naming a master row (superseded rate, ledger, role) that does not exist. */
  REFERENCE_NOT_FOUND = 'TAX_RATE_REFERENCE_NOT_FOUND',
  /** tax_supersedes_id names the rate itself. */
  SELF_SUPERSEDE = 'TAX_RATE_SELF_SUPERSEDE',
  /** tax_supersedes_id names a rate that already supersedes this one — the chain would loop. */
  SUPERSEDE_LOOP = 'TAX_RATE_SUPERSEDE_LOOP',
  /** Delete refused: items, ledgers, charges or open tax-history windows still use the rate. */
  IN_USE = 'TAX_RATE_IN_USE',
  /** Two grid lines override the same role for the same supply nature. */
  LINE_DUPLICATE = 'TAX_RATE_LINE_DUPLICATE',
  /** A grid line's trl_role is not a posting role. */
  LINE_ROLE_UNKNOWN = 'TAX_RATE_LINE_ROLE_UNKNOWN',
  /** A grid line's posting role is inactive. */
  LINE_ROLE_INACTIVE = 'TAX_RATE_LINE_ROLE_INACTIVE',
  /** A grid line's role has one answer for the whole business and cannot be set per rate. */
  LINE_ROLE_NOT_PER_RATE = 'TAX_RATE_LINE_ROLE_NOT_PER_RATE',
  /** A grid line names a supply nature for a role that does not vary by supply nature. */
  LINE_SUPPLY_NATURE_NOT_ALLOWED = 'TAX_RATE_LINE_SUPPLY_NATURE_NOT_ALLOWED',
  /** A line names a tax rate that does not exist or is deleted (assertTaxRateRefs default). */
  REF_NOT_FOUND = 'TAX_RATE_REF_NOT_FOUND',
  /** A line names a tax rate that is inactive (assertTaxRateRefs default). */
  REF_INACTIVE = 'TAX_RATE_REF_INACTIVE',
}
