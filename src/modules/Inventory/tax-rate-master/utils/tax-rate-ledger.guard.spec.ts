import { HttpException } from '@nestjs/common';
import { AccLedgerRole } from '@prisma/client';
import { collectRoleLedgerErrors } from '../../../accountsModule/ledgerRole/ledger-role.helper';
import { TaxRateErrorCode } from '../types/tax-rate-error-codes';
import {
  TaxRateLedgerGuardClient,
  assertTaxRateLedgers,
  collectTaxRateLedgerErrors,
} from './tax-rate-ledger.guard';

// Ledger fitness (type, duty head, group nature, global) is the shared helper's
// job and has its own tests; here it only has to be asked the right question.
jest.mock('../../../accountsModule/ledgerRole/ledger-role.helper', () => ({
  collectRoleLedgerErrors: jest.fn(),
}));
const ledgerErrors = collectRoleLedgerErrors as jest.MockedFunction<typeof collectRoleLedgerErrors>;

const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46ae01';
const OTHER_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46ae02';

const role = (overrides: Partial<AccLedgerRole> = {}): AccLedgerRole => ({
  alrRole: 'OUTPUT_CGST',
  alrLabel: 'Output CGST',
  alrGroup: 'TAX',
  alrWantType: null,
  alrWantDuty: null,
  alrWantNature: null,
  alrBySupply: false,
  alrByRate: true,
  alrSortOrder: 1,
  alrIsActive: true,
  alrRemarks: null,
  alrSyncDate: null,
  ...overrides,
});

const CATALOGUE: AccLedgerRole[] = [
  role(),
  role({ alrRole: 'SALES', alrLabel: 'Sales', alrGroup: 'REVENUE', alrBySupply: true }),
  role({ alrRole: 'ROUND_OFF', alrLabel: 'Round off', alrByRate: false }),
  role({ alrRole: 'OUTPUT_CESS', alrLabel: 'Output cess', alrIsActive: false }),
];

const clientWith = (roles = CATALOGUE) => {
  const findMany = jest.fn(async ({ where }: { where: { alrRole: { in: string[] } } }) =>
    roles.filter((r) => where.alrRole.in.includes(r.alrRole)),
  );
  return {
    findMany,
    client: {
      accLedgerRole: { findMany },
      accLedgerMaster: {},
    } as unknown as TaxRateLedgerGuardClient,
  };
};

describe('tax-rate-ledger.guard', () => {
  beforeEach(() => {
    ledgerErrors.mockReset();
    ledgerErrors.mockResolvedValue([]);
  });

  it('reads nothing for an empty grid', async () => {
    const { client, findMany } = clientWith();

    await expect(collectTaxRateLedgerErrors(client, [])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(ledgerErrors).not.toHaveBeenCalled();
  });

  it('passes a sound grid, asking for each distinct role once', async () => {
    const { client, findMany } = clientWith();

    await expect(
      collectTaxRateLedgerErrors(client, [
        { trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID },
        { trl_role: 'SALES', trl_supply_nature: 'INTRA', trl_ledger_id: LEDGER_ID },
        { trl_role: 'SALES', trl_supply_nature: 'INTER', trl_ledger_id: OTHER_LEDGER_ID },
      ]),
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { alrRole: { in: ['OUTPUT_CGST', 'SALES'] } },
    });
  });

  it('asks the ledger helper about every line with a known role, as global ledgers', async () => {
    const { client } = clientWith();

    await collectTaxRateLedgerErrors(client, [
      { trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID },
      { trl_role: 'NOT_A_ROLE', trl_ledger_id: LEDGER_ID },
      { trl_role: 'SALES', trl_ledger_id: OTHER_LEDGER_ID },
    ]);

    expect(ledgerErrors).toHaveBeenCalledWith(
      client,
      [
        { role: 'OUTPUT_CGST', ledgerId: LEDGER_ID, field: 'lines.0.trl_ledger_id' },
        { role: 'SALES', ledgerId: OTHER_LEDGER_ID, field: 'lines.2.trl_ledger_id' },
      ],
      { companyId: null, where: 'tax_rate_ledger' },
    );
  });

  it("returns the ledger helper's own errors with the rest", async () => {
    const { client } = clientWith();
    const unfit = { field: 'lines.0.trl_ledger_id', code: 'LEDGER_ROLE_MISMATCH', message: 'x' };
    ledgerErrors.mockResolvedValue([unfit]);

    await expect(
      collectTaxRateLedgerErrors(client, [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID }]),
    ).resolves.toEqual([unfit]);
  });

  // ── the rules ─────────────────────────────────────────────────────────────
  it.each([
    [
      'a role the catalogue does not have',
      { trl_role: 'NOT_A_ROLE', trl_ledger_id: LEDGER_ID },
      'lines.0.trl_role',
      TaxRateErrorCode.LINE_ROLE_UNKNOWN,
    ],
    [
      'an inactive role',
      { trl_role: 'OUTPUT_CESS', trl_ledger_id: LEDGER_ID },
      'lines.0.trl_role',
      TaxRateErrorCode.LINE_ROLE_INACTIVE,
    ],
    [
      'a role with one answer for the whole business',
      { trl_role: 'ROUND_OFF', trl_ledger_id: LEDGER_ID },
      'lines.0.trl_role',
      TaxRateErrorCode.LINE_ROLE_NOT_PER_RATE,
    ],
    [
      'a supply nature that is neither INTRA nor INTER',
      { trl_role: 'SALES', trl_supply_nature: 'EXPORT', trl_ledger_id: LEDGER_ID },
      'lines.0.trl_supply_nature',
      TaxRateErrorCode.SUPPLY_NATURE_INVALID,
    ],
    [
      'a supply nature on a role that already implies one',
      { trl_role: 'OUTPUT_CGST', trl_supply_nature: 'INTRA', trl_ledger_id: LEDGER_ID },
      'lines.0.trl_supply_nature',
      TaxRateErrorCode.LINE_SUPPLY_NATURE_NOT_ALLOWED,
    ],
  ])('refuses %s', async (_label, line, field, code) => {
    const { client } = clientWith();

    await expect(collectTaxRateLedgerErrors(client, [line])).resolves.toEqual([
      expect.objectContaining({ field, code }),
    ]);
  });

  it('checks no ledger for a line whose role is unknown', async () => {
    const { client } = clientWith();

    await collectTaxRateLedgerErrors(client, [
      { trl_role: 'NOT_A_ROLE', trl_ledger_id: LEDGER_ID },
    ]);

    expect(ledgerErrors).not.toHaveBeenCalled();
  });

  it('reports every rule a line breaks, not just the first', async () => {
    const { client } = clientWith([
      role({ alrRole: 'ROUND_OFF', alrLabel: 'Round off', alrByRate: false, alrIsActive: false }),
    ]);

    const errors = await collectTaxRateLedgerErrors(client, [
      { trl_role: 'ROUND_OFF', trl_supply_nature: 'INTER', trl_ledger_id: LEDGER_ID },
    ]);

    expect(errors.map((error) => error.code)).toEqual([
      TaxRateErrorCode.LINE_ROLE_INACTIVE,
      TaxRateErrorCode.LINE_ROLE_NOT_PER_RATE,
      TaxRateErrorCode.LINE_SUPPLY_NATURE_NOT_ALLOWED,
    ]);
  });

  // ux_trl_rate_role is NULLS NOT DISTINCT.
  describe('duplicate overrides', () => {
    it('refuses two lines leaving the same role open, naming both lines', async () => {
      const { client } = clientWith();

      await expect(
        collectTaxRateLedgerErrors(client, [
          { trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID },
          { trl_role: 'OUTPUT_CGST', trl_supply_nature: null, trl_ledger_id: OTHER_LEDGER_ID },
        ]),
      ).resolves.toEqual([
        {
          field: 'lines.1.trl_role',
          code: TaxRateErrorCode.LINE_DUPLICATE,
          message: 'Lines 1 and 2 both override OUTPUT_CGST for both supply natures',
        },
      ]);
    });

    it('refuses two lines for the same role and nature', async () => {
      const { client } = clientWith();

      const errors = await collectTaxRateLedgerErrors(client, [
        { trl_role: 'SALES', trl_supply_nature: 'INTRA', trl_ledger_id: LEDGER_ID },
        { trl_role: 'SALES', trl_supply_nature: 'INTER', trl_ledger_id: LEDGER_ID },
        { trl_role: 'SALES', trl_supply_nature: 'INTRA', trl_ledger_id: OTHER_LEDGER_ID },
      ]);

      expect(errors).toEqual([
        expect.objectContaining({
          field: 'lines.2.trl_role',
          code: TaxRateErrorCode.LINE_DUPLICATE,
          message: 'Lines 1 and 3 both override SALES for INTRA',
        }),
      ]);
    });

    it('lets one line per nature stand beside one that leaves the nature open', async () => {
      const { client } = clientWith();

      await expect(
        collectTaxRateLedgerErrors(client, [
          { trl_role: 'SALES', trl_ledger_id: LEDGER_ID },
          { trl_role: 'SALES', trl_supply_nature: 'INTRA', trl_ledger_id: LEDGER_ID },
        ]),
      ).resolves.toEqual([]);
    });
  });

  it("reports against the caller's own field paths and company", async () => {
    const { client } = clientWith();

    const errors = await collectTaxRateLedgerErrors(
      client,
      [{ trl_role: 'NOT_A_ROLE', trl_ledger_id: LEDGER_ID }],
      { fieldPath: (index, field) => `overrides[${index}].${field}` },
    );
    await collectTaxRateLedgerErrors(client, [{ trl_role: 'SALES', trl_ledger_id: LEDGER_ID }], {
      companyId: 'company-1',
    });

    expect(errors[0].field).toBe('overrides[0].trl_role');
    expect(ledgerErrors).toHaveBeenCalledWith(client, expect.any(Array), {
      companyId: 'company-1',
      where: 'tax_rate_ledger',
    });
  });

  describe('assertTaxRateLedgers', () => {
    it('passes a sound grid', async () => {
      const { client } = clientWith();

      await expect(
        assertTaxRateLedgers(client, [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID }]),
      ).resolves.toBeUndefined();
    });

    it('refuses with one 400 under the message given', async () => {
      const { client } = clientWith();

      const error = await assertTaxRateLedgers(
        client,
        [{ trl_role: 'ROUND_OFF', trl_ledger_id: LEDGER_ID }],
        { message: 'Grid refused' },
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).getResponse()).toMatchObject({
        message: 'Grid refused',
        errors: [{ code: TaxRateErrorCode.LINE_ROLE_NOT_PER_RATE }],
      });
    });

    it("defaults the message to 'Validation failed'", async () => {
      const { client } = clientWith();

      const error = (await assertTaxRateLedgers(client, [
        { trl_role: 'NOT_A_ROLE', trl_ledger_id: LEDGER_ID },
      ]).catch((caught: unknown) => caught)) as HttpException;

      expect(error.getResponse()).toMatchObject({ message: 'Validation failed' });
    });
  });
});
