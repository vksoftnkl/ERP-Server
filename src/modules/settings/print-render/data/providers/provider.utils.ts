import { PgService } from 'src/database/pg/pg.service';
import { PrintRow, ProviderRequest } from '../print-data-provider.types';
import { coerceResultRows } from '../value-coercion';

/**
 * A provider's query, with its values already usable in an expression.
 *
 * EVERY provider must go through this rather than calling PgService directly.
 * node-pg hands `numeric` back as a STRING — correct for a driver, because a
 * JavaScript number cannot hold every value a `numeric(15,2)` can, and wrong
 * for a report in a way that hides:
 *
 *   {{ bill.taxable_amt|fmt('#,##0.00') }}   works — the formatter parses it
 *   {{ bill.taxable_amt + bill.tax_amt }}    CONCATENATES: '7960.00' + '1432.80'
 *   {{ row.net_amt > 1000 }}                 compares lexically: '900' > '1000'
 *
 * So the failure is invisible in the common case and silently wrong in the two
 * cases that matter, which is the worst shape a bug can have on a document
 * somebody signs. `coerceResultRows` uses the type OIDs PostgreSQL already
 * declared on the result, so it knows a `numeric` from a bill number that
 * happens to be digits.
 */
export async function providerQuery(
  pg: PgService,
  sql: string,
  params: readonly unknown[],
): Promise<PrintRow[]> {
  return coerceResultRows(await pg.queryReadOnly(sql, params));
}

/**
 * The document quad, checked before a provider reads a partitioned table.
 *
 * Every transactional table in this system is LIST-partitioned by its own
 * accounting year, and the composite primary key is `(id, acc_year)`. A
 * provider that asks for a document without its year gets a query that is
 * CORRECT and scans every partition — which is fast on a fresh install and
 * slower every year, so it fails as a mystery rather than as a bug.
 *
 * Refusing here turns that into one sentence at the top of the render, naming
 * what the request left out.
 */
export function requireDocument(
  request: ProviderRequest,
  providerCode: string,
): { docId: string; accYear: string } {
  const { docId, accYear } = request.context;

  if (!docId) {
    throw new Error(
      `${providerCode} prints one document and the render named none. ` +
        'Send docId — it is what :doc_id binds to.',
    );
  }

  if (!accYear) {
    throw new Error(
      `${providerCode} reads a table partitioned by accounting year, and the render named none. ` +
        "Send accYear ('2026-2027') — it is the document's OWN year, which for a reprint is not " +
        'necessarily the current one.',
    );
  }

  return { docId, accYear };
}
