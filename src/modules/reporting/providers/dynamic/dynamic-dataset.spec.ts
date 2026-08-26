import { BadRequestException } from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import { PgService } from '../../../../database/pg/pg.service';
import { ReportContext } from '../report-data-provider.types';
import {
  findDuplicateColumns,
  humaniseColumnName,
  introspectFields,
  synthesiseSampleRows,
} from './dataset-field.introspector';
import { DynamicDatasetSource } from './dynamic-dataset.source';
import { ReportDatasetSqlValidator } from './report-dataset-sql.validator';
import { SqlReportDatasetProvider } from './sql-report-dataset.provider';
import { ReportDatasetDefinition } from './report-dataset.types';

// bindGridParams / validateBaseSql / findUnboundParamTokens are pure — the
// service's prisma and pg dependencies are never touched by them.
const configuredGridSql = new ConfiguredGridSqlService(
  null as never,
  null as never,
);

const validator = new ReportDatasetSqlValidator(configuredGridSql);

const field = (name: string, dataTypeID: number) =>
  ({ name, dataTypeID }) as unknown as import('pg').FieldDef;

describe('ReportDatasetSqlValidator', () => {
  const scoped = 'SELECT a FROM sales.sale_bill WHERE sb_company_id = p_company_id';

  it('accepts a scoped SELECT', () => {
    const result = validator.validate({ sql: scoped, params: [] });
    expect(result.reservedParamsUsed).toEqual(['p_company_id']);
    expect(result.declaredParamsUsed).toEqual([]);
  });

  it('refuses SQL that never references p_company_id', () => {
    // The whole tenant boundary. A compiled provider had a developer to
    // guarantee this predicate; a stored query has only this check.
    expect(() => validator.validate({ sql: 'SELECT a FROM sales.sale_bill', params: [] })).toThrow(
      /must reference the p_company_id token/,
    );
  });

  it.each([
    ['a second statement', `${scoped}; DROP TABLE sales.sale_bill`],
    ['a write', 'UPDATE sales.sale_bill SET a = 1 WHERE sb_company_id = p_company_id'],
    ['a comment', `${scoped} -- and the rest`],
    ['a positional parameter', `${scoped} AND b = $1`],
  ])('delegates shape rules: refuses %s', (_label, sql) => {
    expect(() => validator.validate({ sql, params: [] })).toThrow(BadRequestException);
  });

  it('refuses an undeclared p_* token', () => {
    // The typo case: p_partyid for p_party_id binds nothing and silently
    // matches no rows, which is how a customer gets an empty statement.
    expect(() =>
      validator.validate({
        sql: `${scoped} AND party = p_partyid`,
        params: [{ name: 'p_party_id', type: 'uuid', required: true }],
      }),
    ).toThrow(/Undeclared parameter token\(s\).*p_partyid/);
  });

  it('refuses a declared parameter that the SQL never uses', () => {
    expect(() =>
      validator.validate({
        sql: scoped,
        params: [{ name: 'p_party_id', type: 'uuid', required: true }],
      }),
    ).toThrow(/never used in the SQL/);
  });

  it('refuses redeclaring a reserved token', () => {
    // Declaring p_company_id would make it caller-suppliable, which is exactly
    // the thing that must remain impossible.
    expect(() =>
      validator.assertValidParamSpecs([{ name: 'p_company_id', type: 'uuid', required: true }]),
    ).toThrow(/reserved/);
  });

  it('requires the custom. namespace so a runtime token cannot shadow a compiled one', () => {
    expect(() => validator.assertValidToken('sales.invoice.header')).toThrow(/must be namespaced/);
    expect(() => validator.assertValidToken('custom.sales.daybook')).not.toThrow();
  });
});

describe('dataset field introspection', () => {
  it('maps pg type OIDs to field types', () => {
    const fields = introspectFields([
      field('bill_no', 1043), // varchar
      field('bill_amt', 1700), // numeric
      field('qty', 23), // int4
      field('bill_date', 1082), // date
      field('created_on', 1184), // timestamptz
      field('is_cancelled', 16), // bool
      field('meta', 3802), // jsonb
    ]);

    expect(fields.map((f) => [f.name, f.type])).toEqual([
      ['bill_no', 'string'],
      ['bill_amt', 'number'],
      ['qty', 'integer'],
      ['bill_date', 'date'],
      ['created_on', 'datetime'],
      ['is_cancelled', 'boolean'],
      ['meta', 'object'],
    ]);
    expect(fields[1].format).toBe('#,##0.00');
  });

  it('honours label and format overrides but never a type override', () => {
    const [only] = introspectFields(
      [field('bill_amt', 1700)],
      [{ name: 'bill_amt', type: 'string', label: 'Net payable', format: '0.00' }],
    );
    expect(only.label).toBe('Net payable');
    expect(only.format).toBe('0.00');
    // The type is a fact about the query, not a preference.
    expect(only.type).toBe('number');
  });

  it('reports duplicate output columns', () => {
    expect(findDuplicateColumns([field('id', 23), field('id', 23), field('n', 25)])).toEqual(['id']);
  });

  it('humanises column names', () => {
    expect(humaniseColumnName('qty_on_hand')).toBe('Qty on hand');
  });

  it('synthesises varied sample rows so a mis-bound column is visible', () => {
    const rows = synthesiseSampleRows(
      [
        { name: 'amt', type: 'number', label: 'Amt' },
        { name: 'nm', type: 'string', label: 'Nm' },
      ],
      3,
    );
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.amt)).size).toBe(3);
  });
});

describe('SqlReportDatasetProvider', () => {
  const definition: ReportDatasetDefinition = {
    id: 'd1',
    token: 'custom.sales.daybook',
    label: 'Daybook',
    cardinality: 'many',
    docTypes: [],
    sql: 'SELECT bill_amt, bill_date FROM sales.sale_bill WHERE sb_company_id = p_company_id AND party = p_party_id',
    params: [{ name: 'p_party_id', type: 'uuid', required: false }],
    fields: [
      { name: 'bill_amt', type: 'number', label: 'Amount' },
      { name: 'bill_date', type: 'date', label: 'Date' },
    ],
    sampleRows: null,
    maxRows: 500,
    version: 1,
  };

  const context: ReportContext = {
    companyId: 'real-company',
    branchId: null,
    accYear: '2026-2027',
    docId: '',
    userId: 'user-1',
  };

  const providerWith = (rows: unknown[]) => {
    const queryReadOnly = jest.fn().mockResolvedValue({ rows, fields: [] });
    const pg = { queryReadOnly } as unknown as PgService;
    return {
      queryReadOnly,
      provider: new SqlReportDatasetProvider(definition, pg, configuredGridSql),
    };
  };

  it('binds context values as parameters and caps rows in SQL', async () => {
    const { provider, queryReadOnly } = providerWith([]);
    await provider.resolve({ ...context, params: { p_party_id: 'party-9' } });

    const [sql, params] = queryReadOnly.mock.calls[0];
    expect(sql).not.toMatch(/p_company_id|p_party_id/);
    expect(sql).toMatch(/LIMIT \$3$/);
    expect(params).toEqual(['real-company', 'party-9', 500]);
  });

  it('ignores a caller-supplied p_company_id', async () => {
    // The binder consumes the reserved tokens from the context FIRST, so by the
    // time caller params are read there is no p_company_id left to bind to.
    const { provider, queryReadOnly } = providerWith([]);
    await provider.resolve({
      ...context,
      params: { p_company_id: 'other-tenant', p_party_id: 'party-9' },
    });

    const [, params] = queryReadOnly.mock.calls[0];
    expect(params).toEqual(['real-company', 'party-9', 500]);
    expect(params).not.toContain('other-tenant');
  });

  it('coerces driver values into display-ready scalars', async () => {
    // node-pg hands numeric back as a STRING; a template footing has to add it.
    const { provider } = providerWith([{ bill_amt: '1234.50', bill_date: '2026-08-24' }]);
    const rows = (await provider.resolve(context)) as Array<Record<string, unknown>>;

    expect(rows[0].bill_amt).toBe(1234.5);
    expect(typeof rows[0].bill_amt).toBe('number');
    expect(rows[0].bill_date).toBe('2026-08-24');
  });

  it('caps a `one` dataset at a single row and returns it unwrapped', async () => {
    const pg = {
      queryReadOnly: jest.fn().mockResolvedValue({ rows: [{ bill_amt: '5' }], fields: [] }),
    } as unknown as PgService;
    const one = new SqlReportDatasetProvider(
      { ...definition, cardinality: 'one' },
      pg,
      configuredGridSql,
    );

    const row = await one.resolve(context);
    expect(Array.isArray(row)).toBe(false);
    expect((row as Record<string, unknown>).bill_amt).toBe(5);
  });

  it('synthesises sample data without touching the database', () => {
    const pg = { queryReadOnly: jest.fn() } as unknown as PgService;
    const provider = new SqlReportDatasetProvider(definition, pg, configuredGridSql);

    const sample = provider.sampleData() as Array<Record<string, unknown>>;
    expect(sample.length).toBeGreaterThan(0);
    expect(typeof sample[0].bill_amt).toBe('number');
    expect(pg.queryReadOnly).not.toHaveBeenCalled();
  });
});

describe('DynamicDatasetSource resilience', () => {
  const configWith = (refreshMs: number) =>
    ({ get: (key: string) => (key === 'REPORT_DATASET_REFRESH_MS' ? refreshMs : undefined) }) as never;

  const sourceWith = (findMany: jest.Mock, aggregate: jest.Mock, refreshMs = 0) =>
    new DynamicDatasetSource(
      { reportDataset: { findMany, aggregate } } as never,
      {} as never,
      configuredGridSql,
      configWith(refreshMs),
    );

  it('boots with zero datasets rather than aborting when the table is missing', async () => {
    // The reported failure: the app started against a database where the
    // migration had not run yet. A throw out of onModuleInit kills the whole
    // server over an empty optional table.
    const missingTable = jest.fn().mockRejectedValue(
      Object.assign(new Error('The table `reports.report_dataset` does not exist'), {
        code: 'P2021',
      }),
    );
    const source = sourceWith(missingTable, missingTable);

    await expect(source.onModuleInit()).resolves.toBeUndefined();
    expect(source.listTokens()).toEqual([]);
    expect(source.list()).toEqual([]);
    expect(source.get('custom.anything')).toBeUndefined();
    source.onModuleDestroy();
  });

  it('still surfaces a load failure to an admin write, which must not look like success', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('connection refused'));
    const source = sourceWith(failing, failing);
    await source.onModuleInit();

    await expect(source.invalidate()).rejects.toThrow('connection refused');
    source.onModuleDestroy();
  });

  it('recovers on the next poll once the table appears', async () => {
    const findMany = jest
      .fn()
      .mockRejectedValueOnce(new Error('does not exist'))
      .mockResolvedValue([
        {
          rdsId: 'a',
          rdsToken: 'custom.late',
          rdsLabel: 'Late',
          rdsCardinality: 'many',
          rdsDocTypes: [],
          rdsSql: 'SELECT 1 WHERE x = p_company_id',
          rdsParams: [],
          rdsFields: [],
          rdsSampleRows: null,
          rdsMaxRows: 10,
          rdsVersion: 1,
        },
      ]);
    // Only findMany fails at boot — refresh() calls it first, so aggregate is
    // never reached on that attempt.
    const aggregate = jest.fn().mockResolvedValue({
      _count: { rdsId: 1 },
      _max: { rdsVersion: 1, rdsModifiedOn: null, rdsCreatedOn: null },
    });

    const source = sourceWith(findMany, aggregate);
    await source.onModuleInit();
    expect(source.listTokens()).toEqual([]);

    // What the interval does once the migration has landed.
    await source.invalidate();
    expect(source.listTokens()).toEqual(['custom.late']);
    source.onModuleDestroy();
  });
});
