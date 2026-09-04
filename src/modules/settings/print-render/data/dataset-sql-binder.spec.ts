import { DatasetBindError, bindDatasetSql, scanParams, withRowLimit } from './dataset-sql-binder';

/**
 * The binder is the first of §4's three runtime boundaries, so these are not
 * tests of a convenience — they are the standing proof that a value cannot
 * become syntax.
 *
 * The cases mirror §4's own verified list of what the CHECK constraints accept
 * and refuse, because the binder has to agree with the guards about what a
 * parameter IS. Where they disagree, one of them is a hole.
 */
describe('scanParams', () => {
  it('finds parameters in order of first appearance, once each', () => {
    expect(
      scanParams('SELECT * FROM t WHERE a = :company_id AND b = :doc_id AND c = :company_id'),
    ).toEqual(['company_id', 'doc_id']);
  });

  it('does not see a parameter inside a string literal — THE 3.0 BUG', () => {
    // 3.0's stored SQL contained ':iacc_year' WITH the quotes, because
    // parameters were a string replace. Here the scanner is inside a literal
    // when it meets the colon, so there is nothing to replace.
    expect(scanParams("SELECT * FROM t WHERE x = ':company_id'")).toEqual([]);
  });

  it("stays inside a literal across a doubled '' escape", () => {
    expect(scanParams("SELECT 'it''s :not_a_param' AS x WHERE c = :company_id")).toEqual([
      'company_id',
    ]);
  });

  it('does not see a parameter inside a line comment', () => {
    expect(scanParams('SELECT 1 -- filter by :doc_id later\nWHERE c = :company_id')).toEqual([
      'company_id',
    ]);
  });

  it('does not see a parameter inside a block comment, including a nested one', () => {
    expect(
      scanParams('SELECT 1 /* outer /* :inner */ :still_comment */ WHERE c = :company_id'),
    ).toEqual(['company_id']);
  });

  it('does not mistake a cast for a parameter', () => {
    expect(scanParams('SELECT x::text FROM t WHERE c = :company_id::uuid')).toEqual(['company_id']);
  });

  it('does not see a quoted identifier as a parameter source', () => {
    expect(scanParams('SELECT "weird :col" FROM t WHERE c = :company_id')).toEqual(['company_id']);
  });

  it('leaves an array slice alone — nothing after the colon names a parameter', () => {
    // The known false positive of ck_ptd_sql_param_shape. The save-time guard
    // is where it is explained; the binder simply finds nothing to bind.
    expect(scanParams('SELECT arr[2:5] FROM t WHERE c = :company_id')).toEqual(['company_id']);
  });
});

describe('bindDatasetSql', () => {
  const context = {
    company_id: 'c-1',
    branch_id: null,
    acc_year: '2026-2027',
    doc_id: 'd-1',
    user_id: null,
    device_id: null,
  };

  it('rewrites parameters to positional placeholders and orders the values to match', () => {
    const bound = bindDatasetSql(
      'SELECT * FROM sales.sale_bill WHERE sb_company_id = :company_id AND sb_id = :doc_id',
      context,
    );

    expect(bound.sql).toBe('SELECT * FROM sales.sale_bill WHERE sb_company_id = $1 AND sb_id = $2');
    expect(bound.params).toEqual(['c-1', 'd-1']);
  });

  it('reuses one placeholder for a parameter written twice', () => {
    const bound = bindDatasetSql(
      'SELECT * FROM t WHERE a = :doc_id OR b = :doc_id AND c = :company_id',
      context,
    );

    expect(bound.sql).toContain('a = $1 OR b = $1');
    expect(bound.params).toEqual(['d-1', 'c-1']);
  });

  it('leaves a colon inside a literal exactly as written', () => {
    const bound = bindDatasetSql(
      "SELECT 'ref::0900-:15' AS note FROM t WHERE c = :company_id",
      context,
    );

    expect(bound.sql).toBe("SELECT 'ref::0900-:15' AS note FROM t WHERE c = $1");
    expect(bound.params).toEqual(['c-1']);
  });

  it('binds a null context value rather than dropping the predicate', () => {
    // `branch_id` is null for a single-location shop. Binding NULL keeps the
    // query's shape; omitting it would silently widen the scope.
    const bound = bindDatasetSql('SELECT 1 FROM t WHERE br = :branch_id', context);
    expect(bound.params).toEqual([null]);
  });

  it('refuses a parameter nothing supplies, and names it', () => {
    expect(() =>
      bindDatasetSql('SELECT 1 FROM t WHERE d >= :from_date AND c = :company_id', context),
    ).toThrow(DatasetBindError);

    try {
      bindDatasetSql('SELECT 1 FROM t WHERE d >= :from_date', context);
    } catch (error) {
      // Refused rather than bound to null: a report whose :from_date silently
      // became NULL returns no rows, and "the report is empty" is the hardest
      // possible bug to trace back to a misspelt prompt.
      expect((error as DatasetBindError).unknownParams).toEqual(['from_date']);
      expect((error as DatasetBindError).message).toContain(':from_date');
      expect((error as DatasetBindError).message).toContain(':company_id');
    }
  });

  it('cannot be made to emit a second statement through a value', () => {
    const bound = bindDatasetSql('SELECT * FROM t WHERE c = :company_id', {
      company_id: "x'; DROP TABLE sales.sale_bill; --",
    });

    // The value never touches the SQL. What PostgreSQL parses is one statement
    // with one placeholder, which is why this is a boundary and not a filter.
    expect(bound.sql).toBe('SELECT * FROM t WHERE c = $1');
    expect(bound.params).toEqual(["x'; DROP TABLE sales.sale_bill; --"]);
  });
});

describe('withRowLimit', () => {
  it('caps in SQL, taking the next free ordinal', () => {
    const capped = withRowLimit(
      bindDatasetSql('SELECT * FROM t WHERE c = :company_id', { company_id: 'c-1' }),
      500,
    );

    expect(capped.sql).toBe('SELECT * FROM (SELECT * FROM t WHERE c = $1) AS ptd_rows LIMIT $2');
    expect(capped.params).toEqual(['c-1', 500]);
  });
});
