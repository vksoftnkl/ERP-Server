import type { PriceScope } from './types/selling-price-bulk.types';

/**
 * Which statement the resolution expects S1 to lead to.
 *
 * A PREDICTION, not a command. S1 still decides — a row that vanished between
 * load and save turns an UPDATE into an INSERT, and that is correct. The value
 * is here because §5.5's table has a "S1 finds" column, and because the
 * response has to be able to tell the operator that *All branches* did nothing
 * to a row that already had an override.
 */
export type ScopeOutcome = 'UPDATE' | 'INSERT';

export interface ScopeResolution {
  /** The scope of the row S1 looks for, and the scope S2/S3 writes at. */
  targetScope: PriceScope;
  /** What S1 filters the branch column on. NULL means the chain row. */
  targetBranchId: string | null;
  expected: ScopeOutcome;
  /**
   * Row 2 of §5.5 — a branch override created OVER a live chain row. The chain
   * row is left byte-identical and every other branch keeps reading it.
   */
  createsBranchOverride: boolean;
  /**
   * Row 4 of §5.5 — the switch said *All branches*, the row already has a
   * branch override, and the override is what gets updated. §13.2 is open on
   * this; the plan's recommendation (update the branch row, do not promote it)
   * is what is implemented, because the other reading silently rewrites every
   * other branch's effective price.
   */
  switchIgnored: boolean;
  /** One sentence, for the response. What Save is about to do to this row. */
  reason: string;
}

/**
 * §5.5 — the whole of it, as a pure function over (switch, row scope).
 *
 * THIS IS THE MODULE'S ACTUAL LOGIC, and it was the legacy 3.0 form's actual
 * bug: every real defect in that screen was in which row an edit landed on, not
 * in the arithmetic. It takes no database, no request and no clock, so it is
 * unit-testable one row of the table at a time.
 *
 * The header radio is NOT a filter on what is displayed. It decides what S1
 * looks for, and therefore whether S2 updates or S3 inserts.
 *
 * @param requested  the header radio: BRANCH = *This branch*, CHAIN = *All branches*
 * @param rowScope   the loaded row's own `priceScope`, or null when the row has
 *                   no price yet (a bucket being priced for the first time)
 * @param branchId   the caller's branch — what a BRANCH-scoped row is keyed on
 */
export function resolveTargetScope(
  requested: PriceScope,
  rowScope: PriceScope | null,
  branchId: string,
): ScopeResolution {
  if (requested === 'CHAIN') {
    if (rowScope === 'BRANCH') {
      // Row 4. The switch does nothing here, ON PURPOSE. Promoting an override
      // to a chain row would move every branch that never asked to move, and
      // the Src chip is how the user sees why their click had no chain effect.
      return {
        targetScope: 'BRANCH',
        targetBranchId: branchId,
        expected: 'UPDATE',
        createsBranchOverride: false,
        switchIgnored: true,
        reason:
          'This row is already a branch override, so All branches updates the override in place. ' +
          'The chain row is not created or changed, and no other branch moves.',
      };
    }
    // Row 3, and a first price at chain scope.
    return {
      targetScope: 'CHAIN',
      targetBranchId: null,
      expected: rowScope === 'CHAIN' ? 'UPDATE' : 'INSERT',
      createsBranchOverride: false,
      switchIgnored: false,
      reason:
        rowScope === 'CHAIN'
          ? 'The chain row is updated. Every branch without its own override moves with it.'
          : 'A chain row is created. Every branch without its own override will read it.',
    };
  }

  if (rowScope === 'CHAIN') {
    // Row 2 — the one the legacy form got wrong. S1 searches at BRANCH scope,
    // so it CANNOT find the chain row, so S3 inserts an override beside it.
    return {
      targetScope: 'BRANCH',
      targetBranchId: branchId,
      expected: 'INSERT',
      createsBranchOverride: true,
      switchIgnored: false,
      reason:
        'A branch override is created for this branch. The chain row is left untouched and ' +
        'every other branch keeps reading it.',
    };
  }

  // Row 1, and a first price at branch scope.
  return {
    targetScope: 'BRANCH',
    targetBranchId: branchId,
    expected: rowScope === 'BRANCH' ? 'UPDATE' : 'INSERT',
    createsBranchOverride: false,
    switchIgnored: false,
    reason:
      rowScope === 'BRANCH'
        ? "This branch's own row is updated. No other branch is affected."
        : 'A row is created for this branch. No other branch is affected.',
  };
}
