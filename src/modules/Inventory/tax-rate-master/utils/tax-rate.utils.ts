import { Prisma, TaxRateLedger, TaxRateMaster } from '@prisma/client';
import {
  ModuleErrorDetail,
  throwInventoryBadRequest,
  throwInventoryConflict,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import {
  TaxRateErrorDetail,
  TaxRateErrorResponse,
  TaxRateLedgerPayload,
  TaxRatePayload,
} from '../types/tax-rate-api.types';

// ─── The vocabularies ────────────────────────────────────────────────────────
// Mirrors of ck_tax_taxability, ck_tax_cess_basis / ck_tax_acess_basis and
// ck_trl_supply_nature. They exist here so a bad value comes back as a field
// error the form can highlight rather than a SQLSTATE 23514 the ORM reports as
// a 500. The database remains the authority — keep these in step with it.

/** MIXED is deliberately absent: a rate is never mixed, a DOCUMENT is. */
export const TAX_TAXABILITIES = [
  'TAXABLE',
  'EXEMPT',
  'NIL_RATED',
  'NON_GST',
  'ZERO_RATED',
] as const;

/**
 * The three that must charge nothing at all (ck_tax_exempt_zero). ZERO_RATED is
 * NOT one of them: an export is genuinely taxable at 0%, and it has to stay
 * distinguishable from an exempt supply on the return.
 */
export const ZERO_ONLY_TAXABILITIES = ['EXEMPT', 'NIL_RATED', 'NON_GST'] as const;

export const CESS_BASES = ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'] as const;

/**
 * Re-exported, not redefined: acc_ledger_map and tax_rate_ledger share one
 * supply-nature vocabulary, and the resolver that reads both owns the copy.
 */
export {
  SUPPLY_NATURES,
  isSupplyNature,
} from '../../../accountsModule/ledgerRole/ledger-map.helper';
export type { SupplyNature } from '../../../accountsModule/ledgerRole/ledger-map.helper';

export const MAX_TAX_RATE_PERC = 100;

// ─── Display lookups ─────────────────────────────────────────────────────────
// The id is the truth; the name is for the screen and is never written back.
// Both are optional on the row types so a bare Prisma row — which is what the
// write paths snapshot for the audit log — still satisfies them.

export const TAX_RATE_LOOKUP = {
  supersedes: { select: { taxName: true } },
} as const;

export const LEDGER_LINE_LOOKUP = {
  role: { select: { alrLabel: true } },
  ledger: { select: { ledName: true } },
} as const;

export type TaxRateLedgerRow = TaxRateLedger & {
  role?: { alrLabel: string } | null;
  ledger?: { ledName: string } | null;
};

export type TaxRateRow = TaxRateMaster & {
  supersedes?: { taxName: string } | null;
  ledgerOverrides?: TaxRateLedgerRow[];
};

// ─── Payload mapping ─────────────────────────────────────────────────────────

export function toLedgerLinePayload(row: TaxRateLedgerRow): TaxRateLedgerPayload {
  return {
    trl_id: row.trlId,
    trl_tax_id: row.trlTaxId,
    trl_role: row.trlRole,
    trl_role_label: row.role?.alrLabel ?? null,
    trl_supply_nature: row.trlSupplyNature,
    trl_ledger_id: row.trlLedgerId,
    trl_ledger_name: row.ledger?.ledName ?? null,
    trl_remarks: row.trlRemarks,
    trl_is_active: row.trlIsActive,
    trl_is_deleted: row.trlIsDeleted,
    trl_sync_date: row.trlSyncDate ? row.trlSyncDate.toISOString() : null,
    trl_created_on: row.trlCreatedOn.toISOString(),
    trl_created_by: row.trlCreatedBy,
    trl_modified_on: row.trlModifiedOn ? row.trlModifiedOn.toISOString() : null,
    trl_modified_by: row.trlModifiedBy,
  };
}

export function toTaxRatePayload(row: TaxRateRow): TaxRatePayload {
  return {
    tax_id: row.taxId,
    tax_name: row.taxName,
    tax_code: row.taxCode,
    tax_sort_order: row.taxSortOrder,
    tax_taxability: row.taxTaxability,
    tax_is_reverse_charge: row.taxIsReverseCharge,
    tax_rate_perc: toNumber(row.taxRatePerc),
    // GENERATED ALWAYS columns: computed by Postgres from tax_rate_perc, and
    // nullable in the datamodel because a generated column is not NOT NULL.
    tax_cgst_perc: toNullableNumber(row.taxCgstPerc),
    tax_sgst_perc: toNullableNumber(row.taxSgstPerc),
    tax_igst_perc: toNullableNumber(row.taxIgstPerc),
    tax_cess_basis: row.taxCessBasis,
    tax_cess_perc: toNumber(row.taxCessPerc),
    tax_cess_per_unit: toNumber(row.taxCessPerUnit),
    tax_acess_basis: row.taxAcessBasis,
    tax_acess_perc: toNumber(row.taxAcessPerc),
    tax_acess_per_unit: toNumber(row.taxAcessPerUnit),
    tax_supersedes_id: row.taxSupersedesId,
    tax_supersedes_name: row.supersedes?.taxName ?? null,
    tax_is_active: row.taxIsActive,
    tax_is_deleted: row.taxIsDeleted,
    tax_sync_date: row.taxSyncDate ? row.taxSyncDate.toISOString() : null,
    tax_created_on: row.taxCreatedOn.toISOString(),
    tax_created_by: row.taxCreatedBy,
    tax_modified_on: row.taxModifiedOn ? row.taxModifiedOn.toISOString() : null,
    tax_modified_by: row.taxModifiedBy,
    lines: (row.ledgerOverrides ?? []).map(toLedgerLinePayload),
  };
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export function throwTaxRateBadRequest(message: string, errors: TaxRateErrorDetail[]): never {
  throwInventoryBadRequest<TaxRateErrorDetail, TaxRateErrorResponse>(message, errors);
}

export function throwTaxRateConflict(message: string, errors: TaxRateErrorDetail[]): never {
  throwInventoryConflict<TaxRateErrorDetail, TaxRateErrorResponse>(message, errors);
}

/**
 * The safety net under the app-side checks, not a replacement for them.
 *
 * Every unique index on these two tables is PARTIAL (`WHERE is_deleted =
 * false`), which Prisma cannot express, so the service checks uniqueness
 * itself. Two requests racing can still both pass that check and let the
 * database settle it — this turns the resulting P2002 into the same 409 the
 * app-side check would have produced.
 */
export function handleTaxRateWriteError(error: unknown): void {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return;
  }
  if (error.code === 'P2002') {
    throwTaxRateConflict('Duplicate tax rate data is not allowed', [
      { field: resolveUniqueField(error), message: 'A record with the same value already exists' },
    ]);
    return;
  }
  if (error.code === 'P2003') {
    throwTaxRateBadRequest('Validation failed', [
      {
        field: resolveForeignKeyField(error),
        message: 'Referenced master record was not found',
      },
    ]);
  }
}

/** Names the offending input from the index Postgres reported, when it can. */
function resolveUniqueField(error: Prisma.PrismaClientKnownRequestError): string {
  const target = describeTarget(error);
  if (target.includes('tax_code')) return 'tax_code';
  if (target.includes('tax_name')) return 'tax_name';
  if (target.includes('trl')) return 'lines';
  return 'request';
}

function resolveForeignKeyField(error: Prisma.PrismaClientKnownRequestError): string {
  const target = describeTarget(error);
  if (target.includes('supersedes')) return 'tax_supersedes_id';
  if (target.includes('ledger')) return 'lines';
  if (target.includes('role')) return 'lines';
  return 'request';
}

function describeTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) return target.join(',');
  return error.message;
}

/** Collects rather than throws, so a whole form is corrected in one round-trip. */
export function pushError(errors: ModuleErrorDetail[], field: string, message: string): void {
  errors.push({ field, message });
}
