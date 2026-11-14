import { Prisma } from '@prisma/client';
import { BRANCH_NUMBER_CODE_PATTERN, branchNumberCode } from './branch-number-code.helper';

const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';

const txAnswering = (rows: { code: string | null }[]) => {
  const $queryRaw = jest.fn(async (..._args: unknown[]) => rows);
  return { $queryRaw, tx: { $queryRaw } as unknown as Prisma.TransactionClient };
};

describe('branchNumberCode (branch serial §5.5, textile D1)', () => {
  it('folds the Bill Prefix, else the code, trimmed and upper-cased in SQL, for one branch', async () => {
    const { $queryRaw, tx } = txAnswering([{ code: 'CBE' }]);

    await expect(branchNumberCode(tx, BRANCH_ID)).resolves.toBe('CBE');
    const [strings, ...values] = $queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = Prisma.sql(strings, ...values);
    expect(sql.text.replace(/\s+/g, ' ')).toContain(
      "upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), ''))) AS code FROM public.branch_master WHERE br_id = $1::uuid",
    );
    expect(sql.values).toEqual([BRANCH_ID]);
  });

  it.each([[[]], [[{ code: null }]], [[{ code: '' }]]])(
    'answers null when the branch has no usable code (%j)',
    async (rows) => {
      await expect(branchNumberCode(txAnswering(rows).tx, BRANCH_ID)).resolves.toBeNull();
    },
  );

  it.each([
    ['CBE', true],
    ['COUNTER2', true],
    ['BR-01', true],
    ['ABCDEFGHIJ', true],
    ['ABCDEFGHIJK', false],
    ['CB/E', false],
    ['HAP CHENNAI', false],
    ['cbe', false],
    ['', false],
  ])('the {BR} shape check takes %p: %p', (code, ok) => {
    expect(BRANCH_NUMBER_CODE_PATTERN.test(code)).toBe(ok);
  });
});
