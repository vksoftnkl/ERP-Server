import { collectDatasetSqlErrors, normalizeDatasetSql } from './print-template-sql-guards';

const messages = (sql: string, requiresCompany = true): string[] =>
  collectDatasetSqlErrors(sql, requiresCompany, 'ptdSql').map((error) => error.message);

const accepts = (sql: string, requiresCompany = true): boolean =>
  collectDatasetSqlErrors(sql, requiresCompany, 'ptdSql').length === 0;

/**
 * The §4 comment lists behaviour VERIFIED against PostgreSQL 18 "so the service
 * layer can reproduce it exactly". These are that list, turned into tests — if
 * the port drifts from the constraints, an author gets refused here and
 * accepted by the database, or the other way round.
 */
describe('normalizeDatasetSql', () => {
  it('replaces literals and quoted identifiers with tokens, and lowercases', () => {
    expect(normalizeDatasetSql(`SELECT "Col" FROM t WHERE x = 'Fred'`)).toBe(
      'select  @id  from t where x =  @lit ',
    );
  });

  it('handles the doubled-quote escape inside a literal', () => {
    expect(normalizeDatasetSql("SELECT 'it''s' FROM t")).toBe('select  @lit  from t');
  });

  it('strips comments BEFORE literals, so a stray quote in a comment cannot mispair', () => {
    expect(normalizeDatasetSql("SELECT a -- don't\nFROM t")).toBe('select a  \nfrom t');
  });

  it('flattens casts, so :: is never mistaken for a parameter', () => {
    expect(normalizeDatasetSql('SELECT a::text FROM t')).toBe('select a text from t');
  });
});

describe('collectDatasetSqlErrors — REFUSED, per the verified list', () => {
  it("refuses 3.0's quoted parameter ':iacc_year'", () => {
    expect(
      messages("SELECT a FROM t WHERE acc_year = ':iacc_year' AND comp = :company_id").some(
        (message) => message.includes('inside a string literal'),
      ),
    ).toBe(true);
  });

  it('refuses a positional parameter :1', () => {
    expect(messages('SELECT a FROM t WHERE x = :1 AND c = :company_id')).toContainEqual(
      expect.stringContaining('not a parameter'),
    );
  });

  it('refuses an array slice arr[2:5], the accepted false positive', () => {
    expect(messages('SELECT arr[2:5] FROM t WHERE c = :company_id')).toContainEqual(
      expect.stringContaining('array slice'),
    );
  });

  it('refuses two statements', () => {
    expect(messages('SELECT a FROM t WHERE c = :company_id; SELECT b FROM u')).toContainEqual(
      expect.stringContaining('Only one statement'),
    );
  });

  it('refuses a data-modifying CTE', () => {
    expect(
      messages('WITH gone AS (DELETE FROM t WHERE c = :company_id RETURNING *) SELECT * FROM gone'),
    ).toContainEqual(expect.stringContaining('may not write'));
  });

  it('refuses dollar quoting', () => {
    expect(messages('SELECT $q$anything$q$ FROM t WHERE c = :company_id')).toContainEqual(
      expect.stringContaining('Dollar quoting'),
    );
  });

  it('refuses a nested block comment', () => {
    expect(
      messages('SELECT a /* outer /* inner */ */ FROM t WHERE c = :company_id'),
    ).toContainEqual(expect.stringContaining('block comment'));
  });

  it('refuses pg_sleep and friends', () => {
    expect(messages('SELECT pg_sleep(10) FROM t WHERE c = :company_id')).toContainEqual(
      expect.stringContaining('reaches outside the query'),
    );
  });

  it('refuses a query with no :company_id when the dataset is company scoped', () => {
    expect(messages('SELECT a FROM t WHERE x = 1 ORDER BY a')).toContainEqual(
      expect.stringContaining('company-scoped'),
    );
  });

  it('refuses anything that does not start with SELECT or WITH', () => {
    expect(messages('EXPLAIN SELECT a FROM t WHERE c = :company_id')).toContainEqual(
      expect.stringContaining('must start with SELECT or WITH'),
    );
  });

  it('refuses a query outside the size bounds, and says nothing else about it', () => {
    expect(messages('SELECT 1')).toHaveLength(1);
  });
});

describe('collectDatasetSqlErrors — ACCEPTED, per the verified list', () => {
  it('accepts a literal BEFORE a parameter — the false positive the count kills', () => {
    expect(accepts("SELECT a FROM t WHERE note = 'last updated' AND x = :company_id")).toBe(true);
  });

  it("accepts the doubled-quote escape 'it''s'", () => {
    expect(accepts("SELECT a FROM t WHERE note = 'it''s fine' AND x = :company_id")).toBe(true);
  });

  it('accepts a semicolon inside a literal', () => {
    expect(accepts("SELECT a FROM t WHERE note = 'a; b' AND x = :company_id")).toBe(true);
  });

  it('accepts last_updated_on — a write keyword inside a column name', () => {
    expect(accepts('SELECT last_updated_on, updated_at FROM t WHERE c = :company_id')).toBe(true);
  });

  it('accepts a leading ( so that (SELECT …) UNION (SELECT …) works', () => {
    expect(
      accepts(
        '(SELECT a FROM t WHERE c = :company_id) UNION (SELECT a FROM u WHERE c = :company_id)',
      ),
    ).toBe(true);
  });

  it('accepts a single trailing semicolon', () => {
    expect(accepts('SELECT a FROM t WHERE c = :company_id ORDER BY a;')).toBe(true);
  });

  it('accepts a global query when ptdRequiresCompany is false', () => {
    expect(accepts('SELECT state_code, state_name FROM fixed.state_code_master', false)).toBe(true);
  });
});

describe('collectDatasetSqlErrors — the two known false positives are explained', () => {
  it('a :name inside a -- comment is refused, and the message says so', () => {
    expect(messages('SELECT a FROM t -- was :acc_year once\nWHERE c = :company_id')).toContainEqual(
      expect.stringContaining('or a comment'),
    );
  });

  it("a '--' inside a literal is refused as not company-scoped, and the message says why", () => {
    const errors = messages("SELECT a FROM t WHERE note = 'x -- y' AND comp_id = :company_id");
    expect(errors).toContainEqual(expect.stringContaining('company-scoped'));
    expect(errors).toContainEqual(expect.stringContaining('inside a string literal'));
  });
});
