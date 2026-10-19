import { DatasetBindError, bindDatasetSql, scanParams, withRowLimit } from './dataset-sql-binder';

/**
 * What the binder hands PostgreSQL around the parameters it rewrites: every
 * comment, literal and quoted identifier must leave exactly as written.
 */
describe('bindDatasetSql — what it leaves untouched', () => {
  const values = { doc_id: 'D-1', from_date: '2026-04-01' };

  it('keeps a line comment verbatim and binds nothing inside it', () => {
    const sql = 'SELECT 1 -- filter on :from_date later\nWHERE id = :doc_id';

    expect(bindDatasetSql(sql, values)).toEqual({
      sql: 'SELECT 1 -- filter on :from_date later\nWHERE id = $1',
      params: ['D-1'],
      bound: ['doc_id'],
    });
  });

  it('keeps a nested block comment verbatim', () => {
    const sql = 'SELECT /* outer /* :doc_id */ still :doc_id */ :from_date';

    expect(bindDatasetSql(sql, values).sql).toBe(
      'SELECT /* outer /* :doc_id */ still :doc_id */ $1',
    );
  });

  it('keeps a quoted identifier holding a colon', () => {
    const sql = 'SELECT 1 AS "a:doc_id", :doc_id';

    expect(bindDatasetSql(sql, values).sql).toBe('SELECT 1 AS "a:doc_id", $1');
  });

  it('keeps a doubled quote inside a quoted identifier', () => {
    expect(scanParams('SELECT 1 AS "x"":doc_id", :from_date')).toEqual(['from_date']);
  });

  it('binds nothing for a query that names no parameter', () => {
    expect(bindDatasetSql('SELECT now()::date', {})).toEqual({
      sql: 'SELECT now()::date',
      params: [],
      bound: [],
    });
  });

  it('names every missing parameter and lists what is bindable, sorted', () => {
    let error: unknown;
    try {
      bindDatasetSql('SELECT :b, :a, :doc_id', { doc_id: 'D-1', user_id: null });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(DatasetBindError);
    expect((error as DatasetBindError).unknownParams).toEqual(['b', 'a']);
    expect((error as Error).message).toMatch(
      /^The query binds :b, :a, which nothing supplies\. Bindable here: :doc_id, :user_id\./,
    );
  });

  it('binds an unsupplied-but-present undefined value as given', () => {
    expect(bindDatasetSql('SELECT :x', { x: undefined }).params).toEqual([undefined]);
  });
});

describe('withRowLimit', () => {
  it('takes $1 for the cap when the query binds nothing', () => {
    expect(withRowLimit(bindDatasetSql('SELECT 1', {}), 5)).toEqual({
      sql: 'SELECT * FROM (SELECT 1) AS ptd_rows LIMIT $1',
      params: [5],
      bound: [],
    });
  });
});
