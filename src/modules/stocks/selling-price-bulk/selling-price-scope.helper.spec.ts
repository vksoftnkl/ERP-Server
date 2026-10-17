import { resolveTargetScope } from './selling-price-scope.helper';

const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';

/**
 * §5.5's table, one test per row.
 *
 * This is the module's actual logic and it was the legacy 3.0 form's actual
 * bug — every real defect in that screen was in which row an edit landed on.
 * It needs no database, no request and no clock, which is exactly why it was
 * worth extracting: the part that broke is the part that is cheapest to prove.
 */
describe('resolveTargetScope — §5.5', () => {
  it('row 1 · This branch over a BRANCH row updates this branch, and only this branch', () => {
    const resolution = resolveTargetScope('BRANCH', 'BRANCH', BRANCH_ID);

    expect(resolution).toMatchObject({
      targetScope: 'BRANCH',
      targetBranchId: BRANCH_ID,
      expected: 'UPDATE',
      createsBranchOverride: false,
      switchIgnored: false,
    });
  });

  it('row 2 · This branch over a CHAIN row creates an override and leaves the chain row alone', () => {
    const resolution = resolveTargetScope('BRANCH', 'CHAIN', BRANCH_ID);

    // The mechanism, not merely the outcome: S1 searches at BRANCH scope, so it
    // CANNOT find the chain row, so the write falls through to S3. The chain
    // row is never read for update and other branches keep reading it.
    expect(resolution).toMatchObject({
      targetScope: 'BRANCH',
      targetBranchId: BRANCH_ID,
      expected: 'INSERT',
      createsBranchOverride: true,
      switchIgnored: false,
    });
  });

  it('row 3 · All branches over a CHAIN row updates the chain row', () => {
    const resolution = resolveTargetScope('CHAIN', 'CHAIN', BRANCH_ID);

    expect(resolution).toMatchObject({
      targetScope: 'CHAIN',
      targetBranchId: null,
      expected: 'UPDATE',
      createsBranchOverride: false,
      switchIgnored: false,
    });
  });

  it('row 4 · All branches over a BRANCH row updates the override, and does NOT promote it', () => {
    const resolution = resolveTargetScope('CHAIN', 'BRANCH', BRANCH_ID);

    // §13.2 is open on this and the two readings differ destructively. The
    // plan's recommendation is implemented: the switch does nothing to a row
    // that already has an override. Promoting it would rewrite the effective
    // price of every branch that never asked to move, and the operator would
    // have no way to see that it had happened.
    expect(resolution).toMatchObject({
      targetScope: 'BRANCH',
      targetBranchId: BRANCH_ID,
      expected: 'UPDATE',
      createsBranchOverride: false,
      switchIgnored: true,
    });
  });

  it('a row with no price yet is created at whichever scope the switch names', () => {
    expect(resolveTargetScope('BRANCH', null, BRANCH_ID)).toMatchObject({
      targetScope: 'BRANCH',
      targetBranchId: BRANCH_ID,
      expected: 'INSERT',
      // Not an "override": there is no chain row here to override.
      createsBranchOverride: false,
    });
    expect(resolveTargetScope('CHAIN', null, BRANCH_ID)).toMatchObject({
      targetScope: 'CHAIN',
      targetBranchId: null,
      expected: 'INSERT',
    });
  });

  it('never returns the caller branch on a chain target — that is what makes S1 miss', () => {
    expect(resolveTargetScope('CHAIN', 'CHAIN', BRANCH_ID).targetBranchId).toBeNull();
    expect(resolveTargetScope('CHAIN', null, BRANCH_ID).targetBranchId).toBeNull();
  });

  it('explains itself in one sentence per row, for the response', () => {
    for (const [requested, rowScope] of [
      ['BRANCH', 'BRANCH'],
      ['BRANCH', 'CHAIN'],
      ['CHAIN', 'CHAIN'],
      ['CHAIN', 'BRANCH'],
    ] as const) {
      expect(resolveTargetScope(requested, rowScope, BRANCH_ID).reason.length).toBeGreaterThan(20);
    }
  });
});
