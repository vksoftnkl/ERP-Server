import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service';
import { StatutoryService, resolveStatutoryLimit } from './statutory.service';
import { STATUTORY_CODES } from './statutory.types';

const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const ON = '2026-10-23';

type Row = {
  stl_id: string;
  stl_code: string;
  stl_section: string | null;
  stl_label: string;
  stl_value_type: string;
  stl_value: Prisma.Decimal | null;
  stl_value_text: string | null;
  stl_enforce: string;
  stl_effective_from: Date;
  stl_effective_to: Date | null;
  stl_source_ref: string | null;
  is_company_override: boolean;
};

const row = (code: string, value: number | null, overrides: Partial<Row> = {}): Row => ({
  stl_id: `stl-${code}`,
  stl_code: code,
  stl_section: null,
  stl_label: code,
  stl_value_type: value === null ? 'TEXT' : 'AMOUNT',
  stl_value: value === null ? null : new Prisma.Decimal(value),
  stl_value_text: null,
  stl_enforce: 'WARN',
  stl_effective_from: new Date('2024-04-01T00:00:00.000Z'),
  stl_effective_to: null,
  stl_source_ref: null,
  is_company_override: false,
  ...overrides,
});

/**
 * A database that answers the resolver from a table keyed `code|appliesTo`
 * (the resolver binds code, company, appliesTo, aatoClass, date, date), and
 * the turnover-class read with `aato`.
 */
const makeDb = (table: Record<string, Row>, aato: string | null = null) => ({
  $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (strings.join('?').includes('comp_aato_class')) {
      return [{ comp_aato_class: aato }];
    }
    const [code, , appliesTo] = values as string[];
    const hit = table[`${code}|${appliesTo}`] ?? table[`${code}|ALL`];
    return hit ? [hit] : [];
  }),
});

const serviceOver = (table: Record<string, Row>, aato: string | null = null) => {
  const db = makeDb(table, aato);
  return { db, service: new StatutoryService(db as unknown as PrismaService) };
};

describe('resolveStatutoryLimit', () => {
  it('maps the row to a limit, with the value as a number and dates as calendar days', async () => {
    const db = makeDb({
      'EWAY_VALUE_LIMIT|ALL': row('EWAY_VALUE_LIMIT', 50000, {
        stl_section: 'Rule 138(1)',
        stl_enforce: 'REFUSE',
        stl_effective_to: new Date('2027-03-31T00:00:00.000Z'),
        stl_source_ref: 'CGST Rules',
        is_company_override: true,
      }),
    });

    await expect(
      resolveStatutoryLimit(db as unknown as PrismaService, COMPANY_ID, 'EWAY_VALUE_LIMIT', ON),
    ).resolves.toEqual({
      id: 'stl-EWAY_VALUE_LIMIT',
      code: 'EWAY_VALUE_LIMIT',
      section: 'Rule 138(1)',
      label: 'EWAY_VALUE_LIMIT',
      valueType: 'AMOUNT',
      value: 50000,
      valueText: null,
      enforce: 'REFUSE',
      effectiveFrom: '2024-04-01',
      effectiveTo: '2027-03-31',
      sourceRef: 'CGST Rules',
      isCompanyOverride: true,
    });
  });

  it('keeps a TEXT row’s value null', async () => {
    const db = makeDb({ 'HSN_DIGITS|ALL': row('HSN_DIGITS', null, { stl_value_text: '6' }) });

    const limit = await resolveStatutoryLimit(
      db as unknown as PrismaService,
      COMPANY_ID,
      'HSN_DIGITS',
      ON,
    );

    expect(limit).toMatchObject({ value: null, valueText: '6', effectiveTo: null });
  });

  // No row means NOT APPLICABLE — never a default figure.
  it('is null when no row is in force', async () => {
    await expect(
      resolveStatutoryLimit(makeDb({}) as unknown as PrismaService, COMPANY_ID, 'X', ON),
    ).resolves.toBeNull();
  });

  it('binds code, company, direction, turnover class and the date twice', async () => {
    const db = makeDb({});

    await resolveStatutoryLimit(
      db as unknown as PrismaService,
      COMPANY_ID,
      'EWAY_VALUE_LIMIT',
      ON,
      '33',
      'LE_5CR',
    );

    expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual([
      'EWAY_VALUE_LIMIT',
      COMPANY_ID,
      '33',
      'LE_5CR',
      ON,
      ON,
    ]);
  });

  it('defaults to every direction and no turnover class', async () => {
    const db = makeDb({});

    await resolveStatutoryLimit(db as unknown as PrismaService, COMPANY_ID, 'X', ON);

    expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual(['X', COMPANY_ID, 'ALL', null, ON, ON]);
  });

  // "This precedence IS the rule. Do not reorder."
  it('orders by company override, then specific direction, then turnover class, then latest', async () => {
    const db = makeDb({});

    await resolveStatutoryLimit(db as unknown as PrismaService, COMPANY_ID, 'X', ON);

    const sql = (db.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    const orderBy = sql.slice(sql.indexOf('ORDER BY'));
    const positions = [
      '(s.stl_company_id IS NOT NULL) DESC',
      "(s.stl_applies_to <> 'ALL')    DESC",
      '(s.stl_aato_class IS NOT NULL) DESC',
      's.stl_effective_from           DESC',
    ].map((clause) => orderBy.indexOf(clause));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(sql).toContain('LIMIT 1');
  });
});

describe('StatutoryService', () => {
  describe('limit', () => {
    it('reads each code/company/date/direction/class once per request', async () => {
      const { db, service } = serviceOver({ 'X|ALL': row('X', 1) });

      await service.limit(COMPANY_ID, 'X', ON);
      await service.limit(COMPANY_ID, 'X', ON);
      await service.limit(COMPANY_ID, 'X', '2026-10-24');

      expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('caches a miss too', async () => {
      const { db, service } = serviceOver({});

      await expect(service.limit(COMPANY_ID, 'X', ON)).resolves.toBeNull();
      await expect(service.limit(COMPANY_ID, 'X', ON)).resolves.toBeNull();

      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('reads through the transaction when one is given', async () => {
      const { db, service } = serviceOver({});
      const tx = makeDb({ 'X|ALL': row('X', 7) });

      const limit = await service.limit(
        COMPANY_ID,
        'X',
        ON,
        'ALL',
        null,
        tx as unknown as Prisma.TransactionClient,
      );

      expect(limit?.value).toBe(7);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('aatoClass', () => {
    it('reads the company’s turnover class, or null', async () => {
      await expect(serviceOver({}, 'GT_10CR').service.aatoClass(COMPANY_ID)).resolves.toBe(
        'GT_10CR',
      );
      await expect(serviceOver({}, null).service.aatoClass(COMPANY_ID)).resolves.toBeNull();
    });
  });

  describe('assertCashLimit (269ST)', () => {
    const table = { 'CASH_TXN_LIMIT_269ST|ALL': row('CASH_TXN_LIMIT_269ST', 200000) };

    it('bites AT the limit, not only above it', async () => {
      const { service } = serviceOver(table);

      await expect(service.assertCashLimit(COMPANY_ID, 200000, ON)).resolves.toMatchObject({
        exceeded: true,
      });
      await expect(service.assertCashLimit(COMPANY_ID, 199999.99, ON)).resolves.toMatchObject({
        exceeded: false,
      });
    });

    it('is never exceeded when no limit is in force', async () => {
      await expect(
        serviceOver({}).service.assertCashLimit(COMPANY_ID, 1e9, ON),
      ).resolves.toEqual({ limit: null, exceeded: false });
    });

    it('is never exceeded when the row carries no figure', async () => {
      const { service } = serviceOver({ 'CASH_TXN_LIMIT_269ST|ALL': row('CASH_TXN_LIMIT_269ST', null) });

      await expect(service.assertCashLimit(COMPANY_ID, 1e9, ON)).resolves.toMatchObject({
        exceeded: false,
      });
    });
  });

  describe('assertPanOrForm60 (114B)', () => {
    it('requires PAN only ABOVE the limit', async () => {
      const { service } = serviceOver({
        'PAN_REQUIRED_CASH_SALE|ALL': row('PAN_REQUIRED_CASH_SALE', 200000),
      });

      await expect(service.assertPanOrForm60(COMPANY_ID, 200000, ON)).resolves.toMatchObject({
        required: false,
      });
      await expect(service.assertPanOrForm60(COMPANY_ID, 200000.01, ON)).resolves.toMatchObject({
        required: true,
      });
    });

    it('requires nothing when no limit is in force', async () => {
      await expect(
        serviceOver({}).service.assertPanOrForm60(COMPANY_ID, 1e9, ON),
      ).resolves.toEqual({ limit: null, required: false });
    });
  });

  describe('ewayApplicable (138(1))', () => {
    const table = {
      'EWAY_VALUE_LIMIT|INTRA_STATE': row('EWAY_VALUE_LIMIT', 50000, { stl_id: 'intra' }),
      'EWAY_VALUE_LIMIT|INTER_STATE': row('EWAY_VALUE_LIMIT', 50000, { stl_id: 'inter' }),
      'EWAY_VALUE_LIMIT|33': row('EWAY_VALUE_LIMIT', 100000, { stl_id: 'tn' }),
    };

    it('uses the state’s own floor for an intra-state move', async () => {
      const { service } = serviceOver(table);

      const result = await service.ewayApplicable(COMPANY_ID, 75000, ON, {
        interState: false,
        stateCode: '33',
      });

      expect(result).toMatchObject({ applicable: false, limit: { id: 'tn', value: 100000 } });
    });

    it('falls back to the direction when the state has no row', async () => {
      const { service, db } = serviceOver(table);

      const result = await service.ewayApplicable(COMPANY_ID, 75000, ON, {
        interState: false,
        stateCode: '29',
      });

      expect(result).toMatchObject({ applicable: true, limit: { id: 'intra' } });
      expect(db.$queryRaw.mock.calls.map((c) => c[3])).toEqual(['29', 'INTRA_STATE']);
    });

    it('ignores the state for an inter-state consignment', async () => {
      const { service, db } = serviceOver(table);

      const result = await service.ewayApplicable(COMPANY_ID, 75000, ON, {
        interState: true,
        stateCode: '33',
      });

      expect(result).toMatchObject({ applicable: true, limit: { id: 'inter' } });
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('needs the value ABOVE the floor', async () => {
      const { service } = serviceOver(table);

      await expect(
        service.ewayApplicable(COMPANY_ID, 50000, ON, { interState: true }),
      ).resolves.toMatchObject({ applicable: false });
    });

    it('is not applicable when no floor is in force', async () => {
      await expect(
        serviceOver({}).service.ewayApplicable(COMPANY_ID, 1e9, ON, { interState: true }),
      ).resolves.toEqual({ limit: null, applicable: false });
    });
  });

  describe('einvoiceApplicable (48(4))', () => {
    const table = { 'EINV_AATO_THRESHOLD|ALL': row('EINV_AATO_THRESHOLD', 50000000) };

    it('is applicable by law when the turnover is above the threshold', async () => {
      await expect(
        serviceOver(table).service.einvoiceApplicable(COMPANY_ID, ON, {
          aatoAmount: 50000000.01,
          companyFlag: false,
        }),
      ).resolves.toMatchObject({ applicable: true, byLaw: true });
    });

    it('is not required by law at the threshold or with no turnover known', async () => {
      const { service } = serviceOver(table);

      await expect(
        service.einvoiceApplicable(COMPANY_ID, ON, { aatoAmount: 50000000, companyFlag: false }),
      ).resolves.toMatchObject({ applicable: false, byLaw: false });
      await expect(
        service.einvoiceApplicable(COMPANY_ID, ON, { aatoAmount: null, companyFlag: false }),
      ).resolves.toMatchObject({ applicable: false, byLaw: false });
    });

    it('is applicable when the company switched it on, even below the threshold', async () => {
      await expect(
        serviceOver({}).service.einvoiceApplicable(COMPANY_ID, ON, {
          aatoAmount: 1,
          companyFlag: true,
        }),
      ).resolves.toEqual({ limit: null, applicable: true, byLaw: false });
    });
  });

  describe('hsnDigits (Rule 46)', () => {
    it('reads the digit count for the company’s turnover class', async () => {
      const { service, db } = serviceOver(
        { 'HSN_DIGITS|ALL': row('HSN_DIGITS', null, { stl_value_text: '6' }) },
        'GT_10CR',
      );

      await expect(service.hsnDigits(COMPANY_ID, ON)).resolves.toMatchObject({ digits: 6 });
      // The resolver call binds the class read from the company.
      expect(db.$queryRaw.mock.calls[1][4]).toBe('GT_10CR');
    });

    it('is null with no row, or a row that is not a number', async () => {
      await expect(serviceOver({}).service.hsnDigits(COMPANY_ID, ON)).resolves.toEqual({
        limit: null,
        digits: null,
      });
      await expect(
        serviceOver({
          'HSN_DIGITS|ALL': row('HSN_DIGITS', null, { stl_value_text: 'n/a' }),
        }).service.hsnDigits(COMPANY_ID, ON),
      ).resolves.toMatchObject({ digits: null });
    });
  });

  describe('withinCancelWindow', () => {
    const generatedOn = new Date('2026-10-22T10:00:00.000Z');
    const table = {
      'EINV_CANCEL_HOURS|ALL': row('EINV_CANCEL_HOURS', 24),
      'EWAY_CANCEL_HOURS|ALL': row('EWAY_CANCEL_HOURS', 12),
    };

    it('lets an IRN go at exactly 24 hours and refuses a minute later', async () => {
      const { service } = serviceOver(table);

      await expect(
        service.withinCancelWindow(
          COMPANY_ID,
          'IRN',
          generatedOn,
          ON,
          new Date('2026-10-23T10:00:00.000Z'),
        ),
      ).resolves.toMatchObject({ within: true, hoursElapsed: 24 });
      await expect(
        service.withinCancelWindow(
          COMPANY_ID,
          'IRN',
          generatedOn,
          ON,
          new Date('2026-10-23T10:01:00.000Z'),
        ),
      ).resolves.toMatchObject({ within: false });
    });

    it('reads the e-way bill’s own window', async () => {
      const { service } = serviceOver(table);

      const result = await service.withinCancelWindow(
        COMPANY_ID,
        'EWAYBILL',
        generatedOn,
        ON,
        new Date('2026-10-22T23:00:00.000Z'),
      );

      expect(result).toMatchObject({ within: false, hoursElapsed: 13, limit: { value: 12 } });
    });

    it('is within when no window is in force — not "zero hours, refuse"', async () => {
      await expect(
        serviceOver({}).service.withinCancelWindow(
          COMPANY_ID,
          'IRN',
          generatedOn,
          ON,
          new Date('2030-01-01T00:00:00.000Z'),
        ),
      ).resolves.toMatchObject({ limit: null, within: true });
    });
  });

  describe('creditNoteCutoff (s.34(2))', () => {
    const table = {
      [`${STATUTORY_CODES.CREDIT_NOTE_CUTOFF}|ALL`]: row('CREDIT_NOTE_CUTOFF', null, {
        stl_value_text: '11-30',
      }),
    };

    it.each([
      ['an October bill', '2025-10-15', '2026-11-30'],
      ['an April bill', '2025-04-01', '2026-11-30'],
      ['a March bill (still the earlier FY)', '2026-03-31', '2026-11-30'],
      ['the next April', '2026-04-01', '2027-11-30'],
    ])('puts the cutoff for %s in November after its FY', async (_label, billDate, cutoff) => {
      await expect(
        serviceOver(table).service.creditNoteCutoff(COMPANY_ID, billDate, '2026-06-01'),
      ).resolves.toMatchObject({ cutoff, passed: false });
    });

    it('has passed only after the cutoff day', async () => {
      const { service } = serviceOver(table);

      await expect(
        service.creditNoteCutoff(COMPANY_ID, '2025-10-15', '2026-11-30'),
      ).resolves.toMatchObject({ passed: false });
      await expect(
        service.creditNoteCutoff(COMPANY_ID, '2025-10-15', '2026-12-01'),
      ).resolves.toMatchObject({ passed: true });
    });

    it('has no cutoff when no row is in force', async () => {
      await expect(
        serviceOver({}).service.creditNoteCutoff(COMPANY_ID, '2025-10-15', '2030-01-01'),
      ).resolves.toEqual({ limit: null, cutoff: null, passed: false });
    });
  });
});
