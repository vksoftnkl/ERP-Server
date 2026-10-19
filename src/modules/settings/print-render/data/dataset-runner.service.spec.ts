import { Logger } from '@nestjs/common';
import { Prisma, PrintTemplateDataset } from '@prisma/client';
import { PgService } from 'src/database/pg/pg.service';
import { RenderContext } from '../types/print-render-api.types';
import { PrintRenderErrorCode } from '../types/print-render-error-codes';
import { DatasetRunError, DatasetRunnerService } from './dataset-runner.service';
import { PrintDataProviderRegistry } from './print-data-provider.registry';
import { PrintDataProvider, ProviderRequest } from './print-data-provider.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e303';

const NUMERIC = 1700;
const TEXT = 25;

const CONTEXT: RenderContext = {
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  docId: BILL_ID,
  userId: null,
  deviceId: null,
};

const dataset = (overrides: Partial<PrintTemplateDataset> = {}): PrintTemplateDataset => ({
  ptdId: 'ptd-1',
  ptdVersionId: 'ptv-1',
  ptdRole: 'DETAIL',
  ptdDatasetNo: 1,
  ptdSortOrder: 1,
  ptdName: 'items',
  ptdLabel: null,
  ptdSourceKind: 'SQL',
  ptdProviderCode: null,
  ptdSql: 'SELECT * FROM sales.sale_bill_item WHERE sbi_bill_id = :doc_id',
  ptdSqlNorm: null,
  ptdParentNo: null,
  ptdLinkFields: null,
  ptdRowLimit: 100,
  ptdTimeoutMs: 15000,
  ptdRemarks: null,
  ptdIsDeleted: false,
  ptdSyncDate: null,
  ptdCreatedOn: new Date('2026-10-01T00:00:00Z'),
  ptdCreatedBy: null,
  ptdModifiedOn: null,
  ptdModifiedBy: null,
  ...overrides,
});

const resultOf = (
  fields: Array<{ name: string; oid: number }>,
  rows: Record<string, unknown>[],
) => ({
  rows,
  fields: fields.map((field) => ({ name: field.name, dataTypeID: field.oid })),
});

const rowsOf = (count: number) =>
  resultOf(
    [{ name: 'line_no', oid: 23 }],
    Array.from({ length: count }, (_unused, index) => ({ line_no: index + 1 })),
  );

describe('DatasetRunnerService', () => {
  let queryReadOnlyTx: jest.Mock;
  let providers: PrintDataProvider[];
  let runner: DatasetRunnerService;

  const build = () => {
    runner = new DatasetRunnerService(
      { queryReadOnlyTx } as unknown as PgService,
      new PrintDataProviderRegistry(providers),
    );
    return runner;
  };

  const provider = (
    code: string,
    resolve: (request: ProviderRequest) => Promise<unknown>,
  ): PrintDataProvider & { resolve: jest.Mock } =>
    ({
      code,
      label: code,
      cardinality: 'many',
      resolve: jest.fn(resolve),
    }) as unknown as PrintDataProvider & { resolve: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queryReadOnlyTx = jest.fn().mockResolvedValue(rowsOf(0));
    providers = [];
    build();
  });

  afterEach(() => jest.restoreAllMocks());

  const run = (datasets: PrintTemplateDataset[], params: Record<string, unknown> = {}) =>
    runner.run({ datasets, context: CONTEXT, params, lang: 'en-IN' });

  /** The DatasetRunError a run was refused with. */
  const failureOf = async (promise: Promise<unknown>): Promise<DatasetRunError> => {
    const error = await promise.then(
      () => {
        throw new Error('expected the run to fail');
      },
      (caught: unknown) => caught,
    );
    if (!(error instanceof DatasetRunError)) throw error;
    return error;
  };

  describe('a stored query', () => {
    it('binds the context by name, caps the rows in SQL and runs inside its own timeout', async () => {
      await run([dataset({ ptdTimeoutMs: 4000 })]);

      const [sql, params, timeout] = queryReadOnlyTx.mock.calls[0] as [string, unknown[], number];
      expect(sql).toBe(
        'SELECT * FROM (SELECT * FROM sales.sale_bill_item WHERE sbi_bill_id = $1) AS ptd_rows LIMIT $2',
      );
      expect(params).toEqual([BILL_ID, 100]);
      expect(timeout).toBe(4000);
    });

    it('lets an answered prompt replace a context default', async () => {
      const otherBill = '019c6f6c-be87-7a11-8905-36092c46e3ff';

      await run([dataset()], { doc_id: otherBill });

      expect(queryReadOnlyTx.mock.calls[0][1]).toEqual([otherBill, 100]);
    });

    it('keeps the context value when a context prompt is left blank', async () => {
      await run([dataset()], { doc_id: null });

      expect(queryReadOnlyTx.mock.calls[0][1]).toEqual([BILL_ID, 100]);
    });

    it('binds a blank ordinary prompt as null rather than dropping it', async () => {
      await run([dataset({ ptdSql: 'SELECT 1 WHERE :godown_id IS NULL' })], { godown_id: null });

      expect(queryReadOnlyTx.mock.calls[0][1]).toEqual([null, 100]);
    });

    it('never lets an answer move company_id off the authenticated company', async () => {
      await run([dataset({ ptdSql: 'SELECT 1 WHERE c = :company_id' })], {
        company_id: '019c6f6c-be87-7a11-8905-36092c46e3aa',
      });

      expect(queryReadOnlyTx.mock.calls[0][1]).toEqual([COMPANY_ID, 100]);
    });

    it('binds an absent context value as null', async () => {
      await run([dataset({ ptdSql: 'SELECT 1 WHERE d = :device_id AND u = :user_id' })]);

      expect(queryReadOnlyTx.mock.calls[0][1]).toEqual([null, null, 100]);
    });

    it('coerces the rows by the types the result declared', async () => {
      queryReadOnlyTx.mockResolvedValue(
        resultOf(
          [
            { name: 'net_amt', oid: NUMERIC },
            { name: 'hsn_code', oid: TEXT },
          ],
          [{ net_amt: '6844.00', hsn_code: '07136000' }],
        ),
      );

      const { data } = await run([dataset()]);

      expect(data.items).toEqual([{ net_amt: 6844, hsn_code: '07136000' }]);
    });

    it('warns about a column the query returns twice', async () => {
      queryReadOnlyTx.mockResolvedValue(
        resultOf(
          [
            { name: 'id', oid: TEXT },
            { name: 'id', oid: TEXT },
          ],
          [{ id: 'b' }],
        ),
      );

      const { warnings } = await run([dataset()]);

      expect(warnings).toEqual([
        expect.objectContaining({ kind: 'duplicate-column', message: expect.stringContaining('returns id more than once') as string }),
      ]);
    });

    it('refuses an SQL dataset with no query', async () => {
      const error = await failureOf(run([dataset({ ptdSql: null })]));

      expect(error.details).toEqual([
        expect.objectContaining({
          field: 'datasets.items.ptdSql',
          code: PrintRenderErrorCode.DATASET_NO_SQL,
        }),
      ]);
      expect(queryReadOnlyTx).not.toHaveBeenCalled();
    });

    it('refuses a query binding a name nothing supplies', async () => {
      const error = await failureOf(run([dataset({ ptdSql: 'SELECT 1 WHERE x = :from_date' })]));

      expect(error.message).toBe("Dataset 'items' cannot be bound");
      expect(error.details[0]).toMatchObject({
        code: PrintRenderErrorCode.DATASET_BIND_FAILED,
        message: expect.stringContaining(':from_date') as string,
      });
    });

    it('names a statement timeout as the dataset running past its limit', async () => {
      queryReadOnlyTx.mockRejectedValue(new Error('canceling statement due to statement timeout'));

      const error = await failureOf(run([dataset({ ptdTimeoutMs: 2500 })]));

      expect(error.message).toBe("Dataset 'items' took longer than its 2500ms limit");
      expect(error.details[0]).toMatchObject({ code: PrintRenderErrorCode.DATASET_TIMED_OUT });
    });

    it("passes any other database failure on with the driver's words", async () => {
      queryReadOnlyTx.mockRejectedValue(new Error('relation "sales.nope" does not exist'));

      const error = await failureOf(run([dataset()]));

      expect(error.message).toBe("Dataset 'items' failed to execute");
      expect(error.details[0]).toMatchObject({
        code: PrintRenderErrorCode.DATASET_FAILED,
        message: 'relation "sales.nope" does not exist',
      });
    });
  });

  describe('limits', () => {
    it('reads a MASTER as one row, asks for one, and never calls it truncated', async () => {
      queryReadOnlyTx.mockResolvedValue(rowsOf(1));

      const { data, resolved, warnings } = await run([
        dataset({ ptdRole: 'MASTER', ptdName: 'invoice', ptdDatasetNo: 0 }),
      ]);

      expect(queryReadOnlyTx.mock.calls[0][1]).toEqual([BILL_ID, 1]);
      expect(data.invoice).toEqual({ line_no: 1 });
      expect(resolved[0]).toMatchObject({ role: 'MASTER', rowCount: 1, truncated: false });
      expect(warnings).toEqual([]);
    });

    it('gives an empty MASTER as {} so every field prints blank', async () => {
      const { data } = await run([dataset({ ptdRole: 'MASTER', ptdName: 'invoice' })]);

      expect(data.invoice).toEqual({});
    });

    it('names a DETAIL that came back at its row limit as possibly truncated', async () => {
      queryReadOnlyTx.mockResolvedValue(rowsOf(3));

      const { resolved, warnings } = await run([dataset({ ptdRowLimit: 3 })]);

      expect(resolved[0]).toMatchObject({ rowCount: 3, truncated: true, sourceKind: 'SQL' });
      expect(warnings).toEqual([
        expect.objectContaining({
          kind: 'row-limit',
          message: expect.stringContaining('full row limit of 3 rows') as string,
        }),
      ]);
    });

    it('does not flag a DETAIL below its limit', async () => {
      queryReadOnlyTx.mockResolvedValue(rowsOf(2));

      const { resolved, warnings } = await run([dataset({ ptdRowLimit: 3 })]);

      expect(resolved[0].truncated).toBe(false);
      expect(warnings).toEqual([]);
    });
  });

  describe('a provider', () => {
    const providerDataset = (overrides: Partial<PrintTemplateDataset> = {}) =>
      dataset({ ptdSourceKind: 'PROVIDER', ptdSql: null, ptdProviderCode: 'test.lines', ...overrides });

    it('gets the context, the answers, the language and the row limit', async () => {
      const lines = provider('test.lines', () => Promise.resolve([]));
      providers = [lines];
      build();

      await runner.run({
        datasets: [providerDataset({ ptdRowLimit: 25 })],
        context: CONTEXT,
        params: { show_cost: true },
        lang: 'ta-IN',
      });

      expect(lines.resolve).toHaveBeenCalledWith({
        context: CONTEXT,
        params: { show_cost: true },
        lang: 'ta-IN',
        rowLimit: 25,
      });
    });

    it('wraps a single row, coerces Decimals and Dates, and caps what it returns', async () => {
      providers = [
        provider('test.one', () =>
          Promise.resolve({ amt: new Prisma.Decimal('12.50'), on: new Date('2026-10-19T04:30:00Z') }),
        ),
        provider('test.lines', () => Promise.resolve([{ n: 1 }, { n: 2 }, { n: 3 }])),
      ];
      build();

      const { data, resolved } = await run([
        providerDataset({ ptdRole: 'MASTER', ptdName: 'head', ptdProviderCode: 'test.one', ptdDatasetNo: 0 }),
        providerDataset({ ptdRowLimit: 2 }),
      ]);

      expect(data.head).toEqual({ amt: 12.5, on: '2026-10-19T04:30:00.000Z' });
      expect(data.items).toEqual([{ n: 1 }, { n: 2 }]);
      expect(resolved[1]).toMatchObject({ sourceKind: 'PROVIDER', truncated: true });
    });

    it('refuses a provider this build does not carry, naming those it does', async () => {
      providers = [provider('company.profile', () => Promise.resolve({}))];
      build();

      const error = await failureOf(run([providerDataset({ ptdProviderCode: 'sales.bill.qr' })]));

      expect(error.details[0]).toMatchObject({
        field: 'datasets.items.ptdProviderCode',
        code: PrintRenderErrorCode.PROVIDER_UNKNOWN,
        message: expect.stringContaining("No provider is registered as 'sales.bill.qr'. Registered: company.profile.") as string,
      });
    });

    it('turns a provider failure into a coded refusal', async () => {
      providers = [provider('test.lines', () => Promise.reject(new Error('Send docId')))];
      build();

      const error = await failureOf(run([providerDataset()]));

      expect(error.message).toBe("Dataset 'items' failed to load");
      expect(error.details[0]).toMatchObject({
        code: PrintRenderErrorCode.PROVIDER_FAILED,
        message: 'Send docId',
      });
    });
  });

  describe('nesting', () => {
    const parentAndChild = (child: Partial<PrintTemplateDataset>) => [
      dataset({ ptdName: 'items', ptdDatasetNo: 1, ptdSql: 'SELECT 1 AS items' }),
      dataset({
        ptdName: 'batches',
        ptdDatasetNo: 2,
        ptdSql: 'SELECT 2 AS batches',
        ptdParentNo: 1,
        ptdLinkFields: 'line_id=line_id',
        ...child,
      }),
    ];

    const answer = (items: Record<string, unknown>[], batches: Record<string, unknown>[]) => {
      queryReadOnlyTx.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('AS items')
            ? resultOf([{ name: 'line_id', oid: TEXT }, { name: 'ver', oid: TEXT }], items)
            : resultOf(
                [
                  { name: 'line_id', oid: TEXT },
                  { name: 'ver', oid: TEXT },
                  { name: 'batch', oid: TEXT },
                ],
                batches,
              ),
        ),
      );
    };

    it('hangs each child row under the parent row it links to, and keeps it at the top level', async () => {
      answer(
        [{ line_id: 'L1' }, { line_id: 'L2' }, { line_id: 'L3' }],
        [
          { line_id: 'L1', batch: 'B1' },
          { line_id: 'L2', batch: 'B2' },
          { line_id: 'L1', batch: 'B3' },
        ],
      );

      const { data } = await run(parentAndChild({}));
      const items = data.items as Array<Record<string, unknown>>;

      expect(items[0].batches).toEqual([
        { line_id: 'L1', ver: null, batch: 'B1' },
        { line_id: 'L1', ver: null, batch: 'B3' },
      ]);
      expect(items[1].batches).toEqual([{ line_id: 'L2', ver: null, batch: 'B2' }]);
      expect(items[2].batches).toEqual([]);
      expect(data.batches).toHaveLength(3);
    });

    it('matches on every link pair, and a value containing a space cannot fake a match', async () => {
      answer(
        [
          { line_id: 'a b', ver: 'c' },
          { line_id: 'a', ver: 'b c' },
        ],
        [{ line_id: 'a', ver: 'b c', batch: 'only-second' }],
      );

      const { data } = await run(parentAndChild({ ptdLinkFields: 'line_id=line_id, ver=ver' }));
      const items = data.items as Array<Record<string, unknown>>;

      expect(items[0].batches).toEqual([]);
      expect(items[1].batches).toEqual([expect.objectContaining({ batch: 'only-second' })]);
    });

    it('attaches to a MASTER parent as well', async () => {
      queryReadOnlyTx.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('AS head')
            ? resultOf([{ name: 'bill_id', oid: TEXT }], [{ bill_id: 'X' }])
            : resultOf([{ name: 'bill_id', oid: TEXT }], [{ bill_id: 'X' }, { bill_id: 'Y' }]),
        ),
      );

      const { data } = await run([
        dataset({ ptdRole: 'MASTER', ptdName: 'head', ptdDatasetNo: 0, ptdSql: 'SELECT 1 AS head' }),
        dataset({ ptdName: 'payments', ptdDatasetNo: 1, ptdParentNo: 0, ptdLinkFields: 'bill_id=bill_id' }),
      ]);

      expect((data.head as Record<string, unknown>).payments).toEqual([{ bill_id: 'X' }]);
    });

    it('warns when the parent dataset number does not exist', async () => {
      const { warnings } = await run(parentAndChild({ ptdParentNo: 9 }));

      expect(warnings).toEqual([
        expect.objectContaining({
          kind: 'missing-dataset',
          message: expect.stringContaining('nested under dataset number 9') as string,
        }),
      ]);
    });

    it('warns when a child names a parent but no link fields', async () => {
      const { warnings } = await run(parentAndChild({ ptdLinkFields: ' , ' }));

      expect(warnings).toEqual([
        expect.objectContaining({ message: expect.stringContaining('no link fields') as string }),
      ]);
    });
  });

  it('starts every dataset before any of them finishes', async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    queryReadOnlyTx.mockImplementation(async (sql: string) => {
      started.push(sql.includes('AS a') ? 'a' : 'b');
      await gate;
      return rowsOf(0);
    });

    const pending = run([
      dataset({ ptdName: 'a', ptdDatasetNo: 1, ptdSql: 'SELECT 1 AS a' }),
      dataset({ ptdName: 'b', ptdDatasetNo: 2, ptdSql: 'SELECT 1 AS b' }),
    ]);
    await new Promise((resolve) => setImmediate(resolve));

    expect(started).toEqual(['a', 'b']);
    release();
    await expect(pending).resolves.toMatchObject({ data: { a: [], b: [] } });
  });
});
