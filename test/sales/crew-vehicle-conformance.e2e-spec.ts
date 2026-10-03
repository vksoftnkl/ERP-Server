// Preload .env exactly like src/main.ts, so DATABASE_URL is present before
// the pg Client is constructed — otherwise it falls back to the OS user.
import '../../src/env.preload';

import { Client } from 'pg';

/**
 * plan-backend-sales.md §12 — the conformance test, first, because this one has
 * already failed in the wild.
 *
 * The five crew/vehicle columns are deliberately repeated on all four
 * goods-moving documents. Repetition is the price of keeping them OFF the
 * shared transport band: a home delivery has a driver and a van and no
 * consignment at all — no transporter, no LR, no e-way bill — so forcing a
 * txn_transport_detail row just to record who drove would be worse.
 *
 * But repetition drifts, and it already had: `supervisor_id` was on the bill
 * ALONE and `vehicle_id` was missing from the DC return before anyone looked.
 * So this asserts it rather than trusting it.
 *
 * It checks the TYPES as well as the names: `loadman_id` must be uuid[]
 * everywhere and the other four scalar, or one document quietly grows a second
 * shape and the next reader believes the first one they open.
 */

const DOCUMENTS: ReadonlyArray<{ table: string; prefix: string }> = [
  { table: 'sale_bill', prefix: 'sb' },
  { table: 'sale_dc', prefix: 'sdc' },
  { table: 'sale_return', prefix: 'sr' },
  { table: 'sale_dc_return', prefix: 'sdr' },
];

/** `loadman_id` is the odd one: an open-ended crew, so an array. */
const SCALAR_COLUMNS = ['driver_id', 'supervisor_id', 'vehicle_id', 'vehicle_no'] as const;
const ARRAY_COLUMNS = ['loadman_id'] as const;

const EXPECTED_UDT: Record<string, string> = {
  driver_id: 'uuid',
  supervisor_id: 'uuid',
  vehicle_id: 'uuid',
  vehicle_no: 'varchar',
  loadman_id: '_uuid', // PostgreSQL spells uuid[] as _uuid in information_schema
};

describe('crew and vehicle conformance across the four goods-moving documents', () => {
  let db: Client;
  let columns: Map<string, { dataType: string; udtName: string }>;

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    const { rows } = await db.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      `SELECT table_name, column_name, data_type, udt_name
         FROM information_schema.columns
        WHERE table_schema = 'sales'
          AND table_name = ANY($1::text[])`,
      [DOCUMENTS.map((d) => d.table)],
    );

    columns = new Map(
      rows.map((r) => [
        `${r.table_name}.${r.column_name}`,
        { dataType: r.data_type, udtName: r.udt_name },
      ]),
    );
  });

  afterAll(async () => {
    await db?.end();
  });

  it('every document carries all five columns — the §12 query returns zero rows', async () => {
    const { rows } = await db.query<{ tbl: string; col: string }>(
      `SELECT p.tbl, p.prefix || '_' || f.col AS col
         FROM (VALUES ('sale_bill','sb'),('sale_dc','sdc'),
                      ('sale_return','sr'),('sale_dc_return','sdr')) AS p(tbl, prefix)
        CROSS JOIN (VALUES ('driver_id'),('supervisor_id'),('loadman_id'),
                           ('vehicle_id'),('vehicle_no')) AS f(col)
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                           WHERE c.table_schema='sales' AND c.table_name=p.tbl
                             AND c.column_name = p.prefix||'_'||f.col)`,
    );

    // Name the offenders — "expected 0 got 3" sends the next reader hunting.
    const missing = rows.map((r) => `${r.tbl}.${r.col}`);
    expect(missing).toEqual([]);
  });

  describe.each(DOCUMENTS)('$table', ({ table, prefix }) => {
    it.each(SCALAR_COLUMNS)('%s is scalar, not an array', (col) => {
      const found = columns.get(`${table}.${prefix}_${col}`);
      expect(found).toBeDefined();
      expect(found!.udtName).toBe(EXPECTED_UDT[col]);
      expect(found!.dataType).not.toBe('ARRAY');
    });

    it.each(ARRAY_COLUMNS)('%s is uuid[] — an open-ended crew', (col) => {
      const found = columns.get(`${table}.${prefix}_${col}`);
      expect(found).toBeDefined();
      expect(found!.dataType).toBe('ARRAY');
      expect(found!.udtName).toBe(EXPECTED_UDT[col]);
    });
  });

  /**
   * The band is the other half of the same decision: these five stay on the
   * DOCUMENT, so they must NOT also appear on txn_transport_detail. Two copies
   * of a vehicle number diverge and no report knows which to trust.
   */
  it('the transport band carries no vehicle and no crew', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'txn_transport_detail'
          AND (column_name LIKE '%driver%' OR column_name LIKE '%supervisor%'
            OR column_name LIKE '%loadman%' OR column_name LIKE '%vehicle%')`,
    );
    expect(rows.map((r) => r.column_name)).toEqual([]);
  });
});
