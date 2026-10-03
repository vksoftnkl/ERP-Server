import { Prisma } from '@prisma/client';
import {
  ModuleErrorDetail,
  throwBadRequest,
  throwNotFound,
} from 'src/common/utils/module-service.utils';

/**
 * accounts.fn_ledger_for, in the application layer — the read side of the
 * posting configuration, and the counterpart to ledger-role.helper, which is
 * its write side.
 *
 * ledger-role.helper answers "may this ledger be mapped to this role?". This
 * one answers the question posting actually asks: "given a role, and the rate /
 * company / branch / supply nature it is being asked for, WHICH ledger?".
 *
 * Two tables can answer, and they are tried in that order:
 *
 *   1. inventory.tax_rate_ledger — the per-GST-rate override. Present only
 *      where a rate genuinely posts somewhere other than the default, which is
 *      why a rate with no lines at all is a complete configuration.
 *   2. accounts.acc_ledger_map — the default, scoped by company and branch.
 *
 * Within each table the MOST SPECIFIC eligible row wins: branch beats company
 * beats global, and a row naming a supply nature beats one that leaves it open.
 * Nothing is scoped today — every acc_ledger_map row has a NULL company and
 * branch — so the extra terms cost one comparison and change no answer until
 * someone inserts a scoped row, which is exactly what those columns are for.
 *
 * Lives here rather than in plpgsql for the same reason the guard does: a
 * function answers with a RAISE that Prisma surfaces as an opaque 500, one
 * failure at a time. Here an unmapped role comes back as a 400 naming the field
 * that asked for it, with every other unmapped role in the same document beside
 * it.
 */

// ─── Supply nature ───────────────────────────────────────────────────────────

/**
 * ck_alm_supply_nature / ck_trl_supply_nature. The canonical copy — the tax
 * rate master re-exports it rather than keeping a second list, because a
 * vocabulary written twice is a vocabulary that drifts.
 */
export const SUPPLY_NATURES = ['INTRA', 'INTER'] as const;

export type SupplyNature = (typeof SUPPLY_NATURES)[number];

export function isSupplyNature(value: unknown): value is SupplyNature {
  return typeof value === 'string' && SUPPLY_NATURES.includes(value as SupplyNature);
}

// ─── The request ─────────────────────────────────────────────────────────────

/** One "which ledger?" question. */
export interface RoleLedgerRequest {
  /** accounts.acc_ledger_role.alr_role — e.g. 'OUTPUT_CGST'. */
  role: string;
  /**
   * The rate the document line was taxed under (sbi_tax_id / soi_tax_id /
   * sqi_tax_id / cd_tax_code). NULL — the normal case, and every historical
   * row — falls straight through to acc_ledger_map.
   */
  taxId?: string | null;
  /**
   * INTRA / INTER. Ignored for a role the catalogue does not mark
   * alr_by_supply: CGST and SGST exist only on an intra-state sale and IGST
   * only on an inter-state one, so those roles already say it.
   */
  supplyNature?: string | null;
  /**
   * The caller's own field name, used when this request cannot be answered —
   * e.g. `items.3.sqiTaxId`, so the error lands on the line the operator is
   * looking at. Defaults to the role name.
   */
  field?: string;
}

export interface ResolveRoleLedgerOptions {
  /**
   * The company the posting belongs to. A row scoped to it beats a global one;
   * a row scoped to a DIFFERENT company is not eligible at all.
   */
  companyId?: string | null;
  /** Same, one level narrower. Beats a company-scoped row. */
  branchId?: string | null;
  /** Names the caller in messages — 'sale_quotation_item', 'tax_rate_master'. */
  where: string;
  /** Message on the 400 raised by the throwing form. */
  message?: string;
}

/** Which table answered, and with what. */
export interface ResolvedRoleLedger {
  role: string;
  roleLabel: string;
  ledgerId: string;
  ledgerName: string;
  /** The nature on the row that won — null when it answers for both. */
  supplyNature: string | null;
  /** TAX_RATE = inventory.tax_rate_ledger; LEDGER_MAP = accounts.acc_ledger_map. */
  source: 'TAX_RATE' | 'LEDGER_MAP';
  /** trl_id or alm_id — the row that answered, for an audit trail or a screen. */
  sourceRowId: string;
}

type LedgerMapClient = Pick<
  Prisma.TransactionClient,
  'accLedgerRole' | 'accLedgerMap' | 'taxRateLedger'
>;

/**
 * The key a resolution is filed under. Two requests differing only in `field`
 * ask the same question and share one answer.
 */
export function roleLedgerKey(request: RoleLedgerRequest): string {
  return `${request.role}|${request.taxId ?? '*'}|${request.supplyNature ?? '*'}`;
}

// ─── The resolver ────────────────────────────────────────────────────────────

/**
 * Every question answered in one round-trip, keyed by roleLedgerKey. A question
 * nothing answers maps to null — the caller decides whether that is fatal
 * (posting) or merely unconfigured (a screen showing where a line WOULD post).
 *
 * A role the catalogue does not know throws 404: that is a programming error in
 * the caller, not bad input from the user. Same rule as ledger-role.helper.
 */
export async function resolveRoleLedgers(
  client: LedgerMapClient,
  requests: readonly RoleLedgerRequest[],
  options: ResolveRoleLedgerOptions,
): Promise<Map<string, ResolvedRoleLedger | null>> {
  const resolved = new Map<string, ResolvedRoleLedger | null>();
  if (requests.length === 0) {
    return resolved;
  }

  const roleNames = [...new Set(requests.map((request) => request.role))];
  const taxIds = [
    ...new Set(
      requests
        .map((request) => request.taxId)
        .filter((taxId): taxId is string => typeof taxId === 'string' && taxId.length > 0),
    ),
  ];

  const [roles, overrides, maps] = await Promise.all([
    client.accLedgerRole.findMany({
      where: { alrRole: { in: roleNames } },
      select: { alrRole: true, alrLabel: true, alrBySupply: true, alrIsActive: true },
    }),
    taxIds.length > 0
      ? client.taxRateLedger.findMany({
          where: {
            trlTaxId: { in: taxIds },
            trlRole: { in: roleNames },
            trlIsDeleted: false,
            trlIsActive: true,
          },
          select: {
            trlId: true,
            trlTaxId: true,
            trlRole: true,
            trlSupplyNature: true,
            trlLedgerId: true,
            ledger: { select: { ledName: true } },
          },
        })
      : Promise.resolve([]),
    // Every live row for these roles, filtered and ranked below rather than in
    // the WHERE clause. The table holds one row per role — a few dozen — so the
    // round-trip is the cost, not the rows, and the precedence rule stays in
    // one readable place instead of being split between a query and a sort.
    client.accLedgerMap.findMany({
      where: { almRole: { in: roleNames }, almIsDeleted: false, almIsActive: true },
      select: {
        almId: true,
        almRole: true,
        almCompanyId: true,
        almBranchId: true,
        almSupplyNature: true,
        almLedgerId: true,
        ledger: { select: { ledName: true } },
      },
    }),
  ]);

  const roleByName = new Map(roles.map((role) => [role.alrRole, role]));
  const unknownRole = requests.find((request) => !roleByName.has(request.role));
  if (unknownRole) {
    throwNotFound(
      `${options.where}: "${unknownRole.role}" is not a posting role`,
      unknownRole.field ?? unknownRole.role,
      `accounts.acc_ledger_role has no row for ${unknownRole.role}`,
    );
  }

  const companyId = options.companyId ?? null;
  const branchId = options.branchId ?? null;

  for (const request of requests) {
    const key = roleLedgerKey(request);
    if (resolved.has(key)) {
      continue;
    }
    const role = roleByName.get(request.role)!;
    // A role that does not vary by supply nature has none: passing one is not
    // an error, it simply cannot narrow anything. Rejecting it here would make
    // every caller special-case the tax roles before asking.
    const nature =
      role.alrBySupply && isSupplyNature(request.supplyNature) ? request.supplyNature : null;

    resolved.set(
      key,
      role.alrIsActive
        ? (bestOverride(overrides, request, nature, role.alrLabel) ??
            bestMapping(maps, request.role, nature, companyId, branchId, role.alrLabel))
        : null,
    );
  }

  return resolved;
}

/** The single-question form. Null when nothing is mapped. */
export async function resolveRoleLedger(
  client: LedgerMapClient,
  request: RoleLedgerRequest,
  options: ResolveRoleLedgerOptions,
): Promise<ResolvedRoleLedger | null> {
  const resolved = await resolveRoleLedgers(client, [request], options);
  return resolved.get(roleLedgerKey(request)) ?? null;
}

/**
 * The throwing form: a 400 listing every question nothing answers, or the full
 * map when the configuration is complete. Use it where an unmapped role means
 * the write must not happen — posting, and any save that promises the document
 * will be postable later.
 */
export async function requireRoleLedgers(
  client: LedgerMapClient,
  requests: readonly RoleLedgerRequest[],
  options: ResolveRoleLedgerOptions,
): Promise<Map<string, ResolvedRoleLedger>> {
  const resolved = await resolveRoleLedgers(client, requests, options);
  const errors = describeUnresolved(requests, resolved, options.where);
  if (errors.length > 0) {
    throwBadRequest(options.message ?? 'Validation failed', errors);
  }
  return resolved as Map<string, ResolvedRoleLedger>;
}

/**
 * Everything nothing answers, as field errors — the collecting form, for a save
 * whose ledger problems should be reported alongside its other ones rather than
 * in a round-trip of their own.
 */
export async function collectRoleLedgerGapErrors(
  client: LedgerMapClient,
  requests: readonly RoleLedgerRequest[],
  options: ResolveRoleLedgerOptions,
): Promise<ModuleErrorDetail[]> {
  const resolved = await resolveRoleLedgers(client, requests, options);
  return describeUnresolved(requests, resolved, options.where);
}

// ─── Precedence ──────────────────────────────────────────────────────────────

type OverrideRow = {
  trlId: string;
  trlTaxId: string;
  trlRole: string;
  trlSupplyNature: string | null;
  trlLedgerId: string;
  ledger: { ledName: string } | null;
};

type MappingRow = {
  almId: string;
  almRole: string;
  almCompanyId: string | null;
  almBranchId: string | null;
  almSupplyNature: string | null;
  almLedgerId: string;
  ledger: { ledName: string } | null;
};

/**
 * Step 1 — the rate's own override, if it has one for this role. A row naming
 * the supply nature beats one that leaves it open; ux_trl_rate_role makes that
 * pair unique, so there is never a tie.
 */
function bestOverride(
  overrides: readonly OverrideRow[],
  request: RoleLedgerRequest,
  nature: SupplyNature | null,
  roleLabel: string,
): ResolvedRoleLedger | null {
  if (!request.taxId) {
    return null;
  }
  let best: OverrideRow | null = null;
  for (const row of overrides) {
    if (row.trlTaxId !== request.taxId || row.trlRole !== request.role) continue;
    if (row.trlSupplyNature !== null && row.trlSupplyNature !== nature) continue;
    if (best === null || (row.trlSupplyNature !== null && best.trlSupplyNature === null)) {
      best = row;
    }
  }
  return best === null
    ? null
    : {
        role: request.role,
        roleLabel,
        ledgerId: best.trlLedgerId,
        ledgerName: best.ledger?.ledName ?? '',
        supplyNature: best.trlSupplyNature,
        source: 'TAX_RATE',
        sourceRowId: best.trlId,
      };
}

/**
 * Step 2 — the default mapping. Branch beats company beats global, and within
 * one scope a row naming the nature beats one that leaves it open.
 */
function bestMapping(
  maps: readonly MappingRow[],
  role: string,
  nature: SupplyNature | null,
  companyId: string | null,
  branchId: string | null,
  roleLabel: string,
): ResolvedRoleLedger | null {
  let best: MappingRow | null = null;
  let bestScore = -1;
  for (const row of maps) {
    if (row.almRole !== role) continue;
    if (row.almBranchId !== null && row.almBranchId !== branchId) continue;
    if (row.almCompanyId !== null && row.almCompanyId !== companyId) continue;
    if (row.almSupplyNature !== null && row.almSupplyNature !== nature) continue;
    // 4 > 2 + 1, so the score orders the rows exactly as (branch, company,
    // nature) would lexicographically. ux_alm_role makes the winner unique.
    const score =
      (row.almBranchId !== null ? 4 : 0) +
      (row.almCompanyId !== null ? 2 : 0) +
      (row.almSupplyNature !== null ? 1 : 0);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best === null
    ? null
    : {
        role,
        roleLabel,
        ledgerId: best.almLedgerId,
        ledgerName: best.ledger?.ledName ?? '',
        supplyNature: best.almSupplyNature,
        source: 'LEDGER_MAP',
        sourceRowId: best.almId,
      };
}

// ─── Reporting ───────────────────────────────────────────────────────────────

/**
 * One error per unanswered question, against the caller's own field. Named
 * roles are reported once even when twenty lines asked for them: an operator
 * fixes an unmapped role in Posting Ledgers, not twenty times in the grid.
 */
function describeUnresolved(
  requests: readonly RoleLedgerRequest[],
  resolved: ReadonlyMap<string, ResolvedRoleLedger | null>,
  where: string,
): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  const reported = new Set<string>();
  for (const request of requests) {
    const key = roleLedgerKey(request);
    if (resolved.get(key) || reported.has(key)) {
      continue;
    }
    reported.add(key);
    errors.push({
      field: request.field ?? request.role,
      message:
        `${where}: nothing maps "${request.role}"` +
        `${request.supplyNature ? ` for ${request.supplyNature} supply` : ''} to a ledger` +
        `${request.taxId ? ' — neither the rate nor accounts.acc_ledger_map has a row for it' : ' — accounts.acc_ledger_map has no row for it'}`,
    });
  }
  return errors;
}
