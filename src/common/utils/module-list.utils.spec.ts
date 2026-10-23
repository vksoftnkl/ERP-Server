import type { ConfiguredGridSqlService } from '../configured-grid-sql/configured-grid-sql.service';
import {
  buildListMeta,
  resolvePagination,
  runConfiguredGridQuery,
  runModuleListQuery,
} from './module-list.utils';

describe('buildListMeta', () => {
  it('rounds the page count up', () => {
    expect(buildListMeta(2, 20, 41)).toEqual({ page: 2, limit: 20, total: 41, total_pages: 3 });
  });

  it('has no pages for no rows', () => {
    expect(buildListMeta(1, 20, 0).total_pages).toBe(0);
  });
});

describe('resolvePagination', () => {
  it('defaults to page 1 of 20', () => {
    expect(resolvePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('skips the rows of the earlier pages', () => {
    expect(resolvePagination({ page: 3, limit: 50 })).toEqual({ page: 3, limit: 50, skip: 100 });
  });
});

describe('runModuleListQuery', () => {
  const records = [{ id: 1 }, { id: 2 }];
  const base = () => ({
    countFn: jest.fn(async () => 42),
    findManyFn: jest.fn(async () => records),
    toItemFn: (r: { id: number }) => ({ code: `#${r.id}` }),
  });
  const grid = { items: [{ code: 'from grid' }], meta: buildListMeta(1, 20, 1) };

  it('answers from the configured grid when there is one', async () => {
    const options = { ...base(), configuredGridFn: jest.fn(async () => grid) };

    await expect(runModuleListQuery({ page: 1, limit: 20 }, options)).resolves.toBe(grid);
    expect(options.countFn).not.toHaveBeenCalled();
  });

  it('falls back to Prisma when no configured grid answers', async () => {
    const options = { ...base(), configuredGridFn: jest.fn(async () => null) };

    await expect(runModuleListQuery({ page: 2, limit: 20 }, options)).resolves.toEqual({
      items: [{ code: '#1' }, { code: '#2' }],
      meta: { page: 2, limit: 20, total: 42, total_pages: 3 },
    });
  });

  it('skips the configured grid when the caller filters by field', async () => {
    const options = {
      ...base(),
      hasStructuredFilters: true,
      configuredGridFn: jest.fn(async () => grid),
    };

    const result = await runModuleListQuery({ page: 1, limit: 20 }, options);

    expect(options.configuredGridFn).not.toHaveBeenCalled();
    expect(result.items).toEqual([{ code: '#1' }, { code: '#2' }]);
  });

  it('adds the column styles when a loader is given', async () => {
    const styles = [{ columnName: 'code' }];
    const options = { ...base(), loadStylesFn: jest.fn(async () => styles) };

    const result = await runModuleListQuery({ page: 1, limit: 20 }, options as never);

    expect(result).toHaveProperty('styles', styles);
  });

  it('leaves styles off when the loader finds none', async () => {
    const options = { ...base(), loadStylesFn: jest.fn(async () => undefined) };

    expect(await runModuleListQuery({ page: 1, limit: 20 }, options)).not.toHaveProperty('styles');
  });
});

describe('runConfiguredGridQuery', () => {
  const gridRow = (gridId: bigint, gridSql: string | null) => ({ gridId, gridSql });
  let service: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  const options = {
    tableName: 'item_master',
    alias: 'i',
    search: 'rice',
    page: 2,
    limit: 10,
    skip: 10,
  };
  const run = (extra: Record<string, unknown> = {}) =>
    runConfiguredGridQuery(service as unknown as ConfiguredGridSqlService, {
      ...options,
      ...extra,
    });

  beforeEach(() => {
    service = {
      loadCandidates: jest.fn(async () => [gridRow(5n, ' SELECT * FROM item_master ')]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(({ sql }: { sql: string }) => ({
        isValid: true,
        normalizedSql: sql,
      })),
      runPagedQuery: jest.fn(async () => ({ items: [{ id: 'a' }], total: 31 })),
    };
  });

  it('runs the first valid grid and pages its total', async () => {
    await expect(run()).resolves.toEqual({
      items: [{ id: 'a' }],
      meta: { page: 2, limit: 10, total: 31, total_pages: 4 },
    });
    expect(service.loadCandidates).toHaveBeenCalledWith({ tableName: 'item_master' });
    expect(service.validateBaseSql).toHaveBeenCalledWith({
      sql: 'SELECT * FROM item_master',
      tableName: 'item_master',
    });
    expect(service.runPagedQuery).toHaveBeenCalledWith({
      baseSql: 'SELECT * FROM item_master',
      alias: 'i',
      search: 'rice',
      limit: 10,
      skip: 10,
      gridId: 5n,
    });
  });

  it('is null when the table has no primary grid', async () => {
    service.filterPrimaryFromTable.mockReturnValue([]);

    await expect(run()).resolves.toBeNull();
    expect(service.runPagedQuery).not.toHaveBeenCalled();
  });

  it('skips a blank grid, an invalid grid and a grid that throws, then uses the next', async () => {
    service.loadCandidates.mockResolvedValue([
      gridRow(1n, '   '),
      gridRow(2n, null),
      gridRow(3n, 'DELETE FROM item_master'),
      gridRow(4n, 'SELECT broken'),
      gridRow(5n, 'SELECT ok'),
    ]);
    service.validateBaseSql.mockImplementation(({ sql }: { sql: string }) => ({
      isValid: !sql.startsWith('DELETE'),
      normalizedSql: sql,
    }));
    service.runPagedQuery.mockImplementation(async ({ gridId }: { gridId: bigint }) => {
      if (gridId === 4n) throw new Error('syntax error');
      return { items: [], total: 0 };
    });

    await run();

    expect(service.runPagedQuery.mock.calls.map((c) => c[0].gridId)).toEqual([4n, 5n]);
  });

  it('is null when every grid fails', async () => {
    service.runPagedQuery.mockRejectedValue(new Error('boom'));

    await expect(run()).resolves.toBeNull();
  });

  it('loads a fixed grid by id, without the table-name filter or the primary filter', async () => {
    await run({ fixedGridId: 119n });

    expect(service.loadCandidates).toHaveBeenCalledWith({
      tableName: 'item_master',
      fixedGridId: 119n,
      applyTableNameFilter: false,
    });
    expect(service.filterPrimaryFromTable).not.toHaveBeenCalled();
  });

  it('passes the schema and extra forbidden patterns to the validator', async () => {
    const extraForbiddenPatterns = [{ pattern: /pg_sleep/i, message: 'no' }];

    await run({ primaryTableSchema: 'inventory', extraForbiddenPatterns });

    expect(service.validateBaseSql).toHaveBeenCalledWith(
      expect.objectContaining({ primaryTableSchema: 'inventory', extraForbiddenPatterns }),
    );
  });
});
