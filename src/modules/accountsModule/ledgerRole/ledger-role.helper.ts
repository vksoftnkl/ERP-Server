import { AccLedgerRole, Prisma } from '@prisma/client';
import {
  ModuleErrorDetail,
  throwBadRequest,
  throwNotFound,
} from 'src/common/utils/module-service.utils';

/**
 * Validates a ledger against the posting role it is being mapped to —
 * accounts.acc_ledger_role says what kind of ledger each role may take, and
 * this is the single place that enforces it.
 *
 * "SALES needs an INCOME ledger under an Income group" was otherwise written
 * once per guard that needed it, and three copies of one fact drift. Adding a
 * role (TCS, composition, an RCM variant) stays one INSERT into the catalogue;
 * nothing here lists role names.
 *
 * Lives in the application layer rather than in a plpgsql guard so the caller
 * gets a field-level 400 it can render against its own form, instead of a
 * SQLSTATE its ORM reports as a 500. Pass the transaction client, so the check
 * sees the same snapshot as the write it is guarding.
 */

/** Every ledger column a caller wants validated, paired with its role. */
export interface RoleLedgerRef {
  /** accounts.acc_ledger_role.alr_role — e.g. 'OUTPUT_CGST'. */
  role: string;
  /** The ledger being mapped to it. */
  ledgerId: string;
  /**
   * The field name to report the error against — the caller's own API field,
   * e.g. 'output_cgst_ledger_id', so the message lands on the right input.
   */
  field: string;
}

export interface CheckRoleLedgersOptions {
  /**
   * The company the MAPPING belongs to. null — the only value today — demands a
   * global ledger: the chart is shared and the company lives on the voucher, so
   * a company-scoped ledger would make one company's books absorb everyone's
   * postings. It is a parameter rather than a hard rule only so a company-scoped
   * mapping, if one is ever created, may name that company's own ledger.
   */
  companyId?: string | null;
  /** Names the calling table in messages — 'acc_ledger_map'. */
  where: string;
  /** Message on the 400. Defaults to 'Validation failed'. */
  message?: string;
}

type LedgerRoleClient = Pick<Prisma.TransactionClient, 'accLedgerRole' | 'accLedgerMaster'>;

/** What the catalogue demands of a ledger, plus the label for the message. */
type RoleExpectation = Pick<
  AccLedgerRole,
  'alrRole' | 'alrLabel' | 'alrWantType' | 'alrWantDuty' | 'alrWantNature'
>;

interface LedgerFacts {
  ledId: string;
  ledName: string;
  ledLedgerType: string | null;
  ledGstDutyHead: string | null;
  ledCompanyId: string | null;
  accGroupMaster: { accGroupNature: string | null } | null;
}

/**
 * The throwing form: 400 with a field error per bad pair, or nothing if every
 * ledger is fit for its role. Use it when the ledgers are all the caller has to
 * validate; use collectRoleLedgerErrors when they are one part of a larger form
 * whose errors should be reported together.
 */
export async function checkRoleLedgers(
  tx: LedgerRoleClient,
  refs: readonly RoleLedgerRef[],
  options: CheckRoleLedgersOptions,
): Promise<void> {
  const errors = await collectRoleLedgerErrors(tx, refs, options);
  if (errors.length > 0) {
    throwBadRequest(options.message ?? 'Validation failed', errors);
  }
}

/**
 * Checks every (role, ledger) pair in one pass and returns ALL the failures
 * together, so a form with fourteen ledger pickers is corrected once rather
 * than one round-trip per wrong ledger.
 *
 * A role the catalogue does not know throws 404 rather than returning an error:
 * that is a programming error in the caller, not bad input from the user.
 */
export async function collectRoleLedgerErrors(
  tx: LedgerRoleClient,
  refs: readonly RoleLedgerRef[],
  options: CheckRoleLedgersOptions,
): Promise<ModuleErrorDetail[]> {
  if (refs.length === 0) {
    return [];
  }
  const companyId = options.companyId ?? null;

  const [roles, ledgers] = await Promise.all([
    tx.accLedgerRole.findMany({
      where: { alrRole: { in: [...new Set(refs.map((ref) => ref.role))] } },
      select: {
        alrRole: true,
        alrLabel: true,
        alrWantType: true,
        alrWantDuty: true,
        alrWantNature: true,
      },
    }),
    tx.accLedgerMaster.findMany({
      where: { ledId: { in: [...new Set(refs.map((ref) => ref.ledgerId))] } },
      select: {
        ledId: true,
        ledName: true,
        ledLedgerType: true,
        ledGstDutyHead: true,
        ledCompanyId: true,
        accGroupMaster: { select: { accGroupNature: true } },
      },
    }),
  ]);

  const roleByName = new Map(roles.map((role) => [role.alrRole, role]));
  const ledgerById = new Map(ledgers.map((ledger) => [ledger.ledId, ledger]));

  const unknownRole = refs.find((ref) => !roleByName.has(ref.role));
  if (unknownRole) {
    throwNotFound(
      `${options.where}: "${unknownRole.role}" is not a posting role`,
      unknownRole.field,
      `accounts.acc_ledger_role has no row for ${unknownRole.role}`,
    );
  }

  const errors: ModuleErrorDetail[] = [];
  for (const ref of refs) {
    const ledger = ledgerById.get(ref.ledgerId);
    if (!ledger) {
      errors.push({ field: ref.field, message: `No ledger found with id ${ref.ledgerId}` });
      continue;
    }
    const problem = describeMismatch(roleByName.get(ref.role)!, ledger, companyId);
    if (problem) {
      errors.push({ field: ref.field, message: problem });
    }
  }

  return errors;
}

/**
 * The rule itself: what, if anything, is wrong with this ledger for this role.
 * Returns null when the ledger is fit for the role. A null expectation on the
 * role means "not checked on this axis".
 */
function describeMismatch(
  role: RoleExpectation,
  ledger: LedgerFacts,
  companyId: string | null,
): string | null {
  const nature = ledger.accGroupMaster?.accGroupNature ?? null;

  if (role.alrWantType && ledger.ledLedgerType !== role.alrWantType) {
    return `${role.alrLabel} needs a ${role.alrWantType} ledger, but "${ledger.ledName}" is ${describe(ledger.ledLedgerType)}`;
  }
  if (role.alrWantDuty && ledger.ledGstDutyHead !== role.alrWantDuty) {
    return `${role.alrLabel} needs duty head "${role.alrWantDuty}", but "${ledger.ledName}" has ${describe(ledger.ledGstDutyHead)}`;
  }
  if (role.alrWantNature && nature !== role.alrWantNature) {
    return `${role.alrLabel} must sit under a ${role.alrWantNature} group, but "${ledger.ledName}" is under ${describe(nature)}`;
  }
  // A mapping with no company of its own must name a global ledger.
  if (ledger.ledCompanyId !== null && (companyId === null || ledger.ledCompanyId !== companyId)) {
    return `"${ledger.ledName}" belongs to one company, and this mapping is shared — its ledger must be global`;
  }
  return null;
}

function describe(value: string | null): string {
  return value ? `"${value}"` : '(none)';
}
