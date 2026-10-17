import {
  buildGroupTree,
  groupsRollingInto,
  rollupGroupId,
  treeSortKey,
  type GroupNode,
} from './day-summary.groups';

/** The Tally primaries as they sit on the dev box (plan §4.3), trimmed. */
const g = (
  id: string,
  parentId: string | null,
  sort: number,
  profile = 'General',
  nature: string | null = null,
  isDeleted = false,
): GroupNode => ({ id, name: id, parentId, nature, profile, sort, isDeleted });

const TREE = buildGroupTree([
  g('Current Assets', null, 60, 'General', 'Assets'),
  g('Bank Accounts', 'Current Assets', 61, 'Bank', 'Assets'),
  g('Cash-in-Hand', 'Current Assets', 62, 'Cash', 'Assets'),
  g('Sundry Debtors', 'Current Assets', 66, 'Party', 'Assets'),
  g('Customers', 'Sundry Debtors', 0, 'Party', 'Assets'),
  g('MUSIRI', 'Customers', 3, 'Party', 'Assets'),
  g('Loans (Liability)', null, 20, 'General', 'Liabilities'),
  g('Bank OD A/c', 'Loans (Liability)', 21, 'Bank', 'Liabilities'),
  g('Sales Accounts', null, 100, 'SalesPurchase', 'Income'),
  g('Old child', 'Sales Accounts', 1, 'SalesPurchase', 'Income', true),
  g('Petty', 'Cash-in-Hand', 1, 'General', 'Assets'),
  g('Odd', 'Cash-in-Hand', 2, 'Party', 'Assets'),
  g('Loop A', 'Loop B', 1),
  g('Loop B', 'Loop A', 2),
  g('Orphan', 'missing-parent', 5),
]);

describe('money kind (§4.2): the first non-General profile walking up', () => {
  it.each([
    ['Cash-in-Hand', 'CASH'],
    ['Petty', 'CASH'],
    ['Bank Accounts', 'BANK'],
    ['Bank OD A/c', 'BANK'],
    ['Current Assets', null],
    ['MUSIRI', null],
    ['Sales Accounts', null],
    // A Party group under Cash-in-Hand stops the walk at Party.
    ['Odd', null],
  ])('%s → %s', (id, kind) => {
    expect(TREE.classes.get(id)?.moneyKind).toBe(kind);
  });
});

describe('roll-up (§4.3)', () => {
  it('REPORT = the root’s child; a root stays itself', () => {
    expect(rollupGroupId(TREE, 'MUSIRI', 'REPORT')).toBe('Sundry Debtors');
    expect(rollupGroupId(TREE, 'Cash-in-Hand', 'REPORT')).toBe('Cash-in-Hand');
    expect(rollupGroupId(TREE, 'Petty', 'REPORT')).toBe('Cash-in-Hand');
    expect(rollupGroupId(TREE, 'Current Assets', 'REPORT')).toBe('Current Assets');
    expect(rollupGroupId(TREE, 'Sales Accounts', 'REPORT')).toBe('Sales Accounts');
  });

  it('PRIMARY = the root; LEDGER_GROUP = itself', () => {
    expect(rollupGroupId(TREE, 'MUSIRI', 'PRIMARY')).toBe('Current Assets');
    expect(rollupGroupId(TREE, 'MUSIRI', 'LEDGER_GROUP')).toBe('MUSIRI');
    expect(rollupGroupId(TREE, 'unknown', 'REPORT')).toBe('unknown');
  });

  it('a cycle or a missing parent ends the chain there', () => {
    expect(TREE.classes.get('Loop A')?.chain).toEqual(['Loop A', 'Loop B']);
    expect(rollupGroupId(TREE, 'Orphan', 'PRIMARY')).toBe('Orphan');
  });

  it('groupsRollingInto is the inverse of rollupGroupId', () => {
    expect(groupsRollingInto(TREE, 'Sundry Debtors', 'REPORT').sort()).toEqual(
      ['Customers', 'MUSIRI', 'Sundry Debtors'].sort(),
    );
    // Current Assets at REPORT holds only ledgers sitting in it directly.
    expect(groupsRollingInto(TREE, 'Current Assets', 'REPORT')).toEqual(['Current Assets']);
  });

  it('hasChildren counts live child groups only', () => {
    expect(TREE.withChildren.has('Sundry Debtors')).toBe(true);
    expect(TREE.withChildren.has('Sales Accounts')).toBe(false);
    expect(TREE.withChildren.has('Bank Accounts')).toBe(false);
  });
});

describe('tree order', () => {
  it('roots by acc_group_sort, children after their parent', () => {
    const ids = [
      'Sales Accounts',
      'Sundry Debtors',
      'Cash-in-Hand',
      'Bank Accounts',
      'Current Assets',
      'Bank OD A/c',
    ];
    const sorted = [...ids].sort((a, b) => (treeSortKey(TREE, a) < treeSortKey(TREE, b) ? -1 : 1));
    expect(sorted).toEqual([
      'Bank OD A/c',
      'Current Assets',
      'Bank Accounts',
      'Cash-in-Hand',
      'Sundry Debtors',
      'Sales Accounts',
    ]);
  });
});
