import { AccLedgerRole, Prisma } from '@prisma/client';
import { ModuleErrorDetail, throwBadRequest } from 'src/common/utils/module-service.utils';
import {
  RoleLedgerRef,
  collectRoleLedgerErrors,
} from '../../../accountsModule/ledgerRole/ledger-role.helper';
import { SUPPLY_NATURES } from './tax-rate.utils';

/**
 * inventory.fn_tax_rate_ledger_guard, in the application layer.
 *
 * Three rules stand between a grid row and a rate nobody can post against, and
 * none of them is expressible as a constraint:
 *
 *   1. alr_by_rate — round-off, discount, write-off and advances have ONE
 *      answer for the whole business. They have nothing to do with a GST rate,
 *      so acc_ledger_map is their only home.
 *   2. alr_by_supply — CGST and SGST exist only on an intra-state sale and IGST
 *      only on an inter-state one, so a tax role already SAYS its supply
 *      nature. A row narrowing it further could never be the best match.
 *   3. the ledger must suit the role — type, GST duty head and account-group
 *      nature — and must be global, because a rate is shared by every company
 *      and a company-scoped ledger would make one company's books absorb
 *      everyone's postings.
 *
 * An FK cannot read a column of the table it points at, which rules out 1 and
 * 2; 3 is a three-table join. A BEFORE INSERT/UPDATE trigger could do all
 * three — and the first draft of this schema did exactly that — but it answers
 * with a RAISE that Prisma surfaces as an opaque 500, one failure at a time, on
 * the first bad row it reaches. Here the same rules answer with a 400 carrying
 * a field path per bad line, so a grid of fourteen ledger pickers is corrected
 * in one round-trip instead of fourteen.
 *
 * Pass the transaction client, so the guard reads the same snapshot as the
 * write it is guarding.
 */

/** The shape the guard needs. Any DTO with these three keys satisfies it. */
export interface TaxRateLedgerLineInput {
  trl_role: string;
  trl_supply_nature?: string | null;
  trl_ledger_id: string;
}

export type TaxRateLedgerGuardClient = Pick<
  Prisma.TransactionClient,
  'accLedgerRole' | 'accLedgerMaster'
>;

export interface TaxRateLedgerGuardOptions {
  /**
   * Names the field an error is reported against. Defaults to the grid path the
   * save payload uses — `lines.0.trl_role` — so the message lands on the row
   * the operator is looking at.
   */
  fieldPath?: (index: number, field: string) => string;
  /**
   * NULL — the only value today — demands a global ledger. It is a parameter
   * only so a company-scoped rate, if one is ever created, may name that
   * company's own ledger.
   */
  companyId?: string | null;
  /** Message on the 400 raised by the throwing form. */
  message?: string;
}

const defaultFieldPath = (index: number, field: string): string => `lines.${index}.${field}`;

/**
 * The throwing form: a 400 listing every bad line, or nothing when the grid is
 * sound. Use it when the lines are all there is left to validate; use
 * collectTaxRateLedgerErrors when they are one part of a larger form whose
 * errors should be reported together.
 */
export async function assertTaxRateLedgers(
  client: TaxRateLedgerGuardClient,
  lines: readonly TaxRateLedgerLineInput[],
  options: TaxRateLedgerGuardOptions = {},
): Promise<void> {
  const errors = await collectTaxRateLedgerErrors(client, lines, options);
  if (errors.length > 0) {
    throwBadRequest(options.message ?? 'Validation failed', errors);
  }
}

/**
 * Everything wrong with the grid, in one list: duplicate overrides, roles that
 * may not be overridden per rate, supply natures on roles that already imply
 * one, and ledgers unfit for the role they are mapped to.
 */
export async function collectTaxRateLedgerErrors(
  client: TaxRateLedgerGuardClient,
  lines: readonly TaxRateLedgerLineInput[],
  options: TaxRateLedgerGuardOptions = {},
): Promise<ModuleErrorDetail[]> {
  if (lines.length === 0) {
    return [];
  }
  const field = options.fieldPath ?? defaultFieldPath;
  const errors: ModuleErrorDetail[] = [];

  collectDuplicateErrors(errors, lines, field);

  const roles = await client.accLedgerRole.findMany({
    where: { alrRole: { in: [...new Set(lines.map((line) => line.trl_role))] } },
  });
  const roleByName = new Map<string, AccLedgerRole>(roles.map((role) => [role.alrRole, role]));

  const ledgerRefs: RoleLedgerRef[] = [];
  lines.forEach((line, index) => {
    const role = roleByName.get(line.trl_role);
    if (!role) {
      errors.push({
        field: field(index, 'trl_role'),
        message: `"${line.trl_role}" is not a posting role — accounts.acc_ledger_role has no such row`,
      });
      // No role means no expectation to check the ledger against, so this row
      // contributes nothing further. It is also why the ref is not collected:
      // the ledger helper answers 404 for an unknown role, and here an unknown
      // role is the caller's input, not a bug in the caller.
      return;
    }

    collectRoleErrors(errors, line, role, index, field);

    ledgerRefs.push({
      role: line.trl_role,
      ledgerId: line.trl_ledger_id,
      field: field(index, 'trl_ledger_id'),
    });
  });

  if (ledgerRefs.length > 0) {
    errors.push(
      ...(await collectRoleLedgerErrors(client, ledgerRefs, {
        companyId: options.companyId ?? null,
        where: 'tax_rate_ledger',
      })),
    );
  }

  return errors;
}

/** Rules 1 and 2 — the two the trigger owned that no constraint can state. */
function collectRoleErrors(
  errors: ModuleErrorDetail[],
  line: TaxRateLedgerLineInput,
  role: AccLedgerRole,
  index: number,
  field: (index: number, field: string) => string,
): void {
  if (!role.alrIsActive) {
    errors.push({
      field: field(index, 'trl_role'),
      message: `Posting role "${role.alrLabel}" is inactive`,
    });
  }

  if (!role.alrByRate) {
    errors.push({
      field: field(index, 'trl_role'),
      message:
        `"${role.alrLabel}" has one answer for the whole business and cannot be set per rate — ` +
        'map it in accounts.acc_ledger_map instead',
    });
  }

  const nature = line.trl_supply_nature ?? null;
  if (nature === null) {
    return;
  }
  if (!SUPPLY_NATURES.includes(nature as (typeof SUPPLY_NATURES)[number])) {
    errors.push({
      field: field(index, 'trl_supply_nature'),
      message: `trl_supply_nature must be ${SUPPLY_NATURES.join(' or ')}, or null for both`,
    });
    return;
  }
  if (!role.alrBySupply) {
    errors.push({
      field: field(index, 'trl_supply_nature'),
      message:
        `"${role.alrLabel}" does not vary by supply nature — CGST and SGST exist only on an ` +
        'intra-state sale and IGST only on an inter-state one, so the role already says it. ' +
        'Leave trl_supply_nature null.',
    });
  }
}

/**
 * ux_trl_rate_role, restated. The index is NULLS NOT DISTINCT, so two lines
 * both leaving the supply nature open collide with each other — not only with a
 * line that names one.
 */
function collectDuplicateErrors(
  errors: ModuleErrorDetail[],
  lines: readonly TaxRateLedgerLineInput[],
  field: (index: number, field: string) => string,
): void {
  const seen = new Map<string, number>();
  lines.forEach((line, index) => {
    const key = `${line.trl_role}|${line.trl_supply_nature ?? '*'}`;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, index);
      return;
    }
    errors.push({
      field: field(index, 'trl_role'),
      message:
        `Lines ${first + 1} and ${index + 1} both override ${line.trl_role}` +
        `${line.trl_supply_nature ? ` for ${line.trl_supply_nature}` : ' for both supply natures'}`,
    });
  });
}
