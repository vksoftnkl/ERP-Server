import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PRINT_DESIGN_USABLE_RULE, printDesignRuleText } from './print-design-usable.sql';

/**
 * Voucher Types re-review R4: the S2 "usable print design" rule (decision 62)
 * lives in the server as PRINT_DESIGN_USABLE_RULE and is copied word for word
 * into two SQL texts that cannot import it. This guard fails when a copy drifts
 * from the server's text:
 *
 *   1. grid 86 "TXN MAIN LIST - BILLS" in prisma/seed/Grid_Details.sql
 *      (print_purpose_code; aliases cpp / bpp, company b.sb_company_id);
 *   2. the Sales Invoice A5 header dataset in the workspace docs,
 *      docs/print-templates/sale-invoice-a5/datasets/0-header.sql (doc_title;
 *      aliases op / bp, company sb.sb_company_id), and the deploy SQL
 *      build-deploy.py writes from it (sale-invoice-a5-deploy.sql).
 *
 * The docs live beside this repo (/home/vk/Dev/erp/docs), not in it. A
 * server-only checkout (the GitHub release workflow runs `npm test` on this repo
 * alone) has no docs folder: there the docs checks are SKIPPED, and the test name
 * says so. Where the docs folder exists, a missing dataset or deploy file FAILS:
 * the files moved and this guard must follow them.
 *
 * Not checked here: the applied migration 20261116110000 (a migration is never
 * edited; a later rule change ships a new one) and the live fixed.grid_details
 * row (the seed is ON CONFLICT DO NOTHING; that is the DB's copy, not a file).
 */

const SERVER_ROOT = resolve(__dirname, '..', '..', '..', '..');
const GRID_DETAILS = resolve(SERVER_ROOT, 'prisma', 'seed', 'Grid_Details.sql');
const DOCS_PRINT_TEMPLATES = resolve(SERVER_ROOT, '..', 'docs', 'print-templates');
const SALE_INVOICE_A5 = resolve(DOCS_PRINT_TEMPLATES, 'sale-invoice-a5');
const HEADER_DATASET = resolve(SALE_INVOICE_A5, 'datasets', '0-header.sql');
const DEPLOY_SQL = resolve(SALE_INVOICE_A5, 'sale-invoice-a5-deploy.sql');

const rule = (alias: string, company: string) =>
  printDesignRuleText(PRINT_DESIGN_USABLE_RULE, alias, company);

/**
 * null when `copy` holds `text` exactly; else where it stops matching, line by
 * line, so a failure names the drifted line instead of printing the whole file.
 */
function drift(copy: string, text: string): string | null {
  if (copy.includes(text)) {
    return null;
  }
  const lines = text.split('\n');
  // A whole line matches only up to its line break, so an edit at a line's end
  // is reported at that line.
  const holds = (n: number) =>
    copy.includes(lines.slice(0, n).join('\n') + (n < lines.length ? '\n' : ''));
  let same = 0;
  while (same < lines.length && holds(same + 1)) {
    same += 1;
  }
  return same === 0
    ? `the rule's first line is not in the copy: ${lines[0]}`
    : `the copy matches the rule's first ${same} line(s), then differs at: ${lines[same].trim()}`;
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The parts in this order, any whitespace between them; each part verbatim. */
const inOrder = (...parts: string[]) => new RegExp(parts.map(escape).join('\\s+'));

/** grid 86's SQL: the $seed$ … $seed$ body of the row whose grid_id is 86. */
function grid86Sql(): string {
  const seed = readFileSync(GRID_DETAILS, 'utf8');
  const row = /^\s*,?\(\s*86\s*,[^$\n]*\$seed\$([\s\S]*?)\$seed\$/m.exec(seed);
  if (!row) {
    throw new Error(`grid 86 not found in ${GRID_DETAILS}`);
  }
  return row[1];
}

function readDoc(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `${path} is missing while ${DOCS_PRINT_TEMPLATES} exists: the Sales Invoice print docs moved or were renamed. ` +
        'Point this guard (print-design-usable.copies.spec.ts) at the new place.',
    );
  }
  return readFileSync(path, 'utf8');
}

describe('the usable print design rule has not drifted in its copies (re-review R4)', () => {
  it('grid 86 (prisma/seed/Grid_Details.sql) holds it word for word for the own and the base design', () => {
    const sql = grid86Sql();
    expect(sql).toContain('AS print_purpose_code');
    expect(drift(sql, rule('cpp', 'b.sb_company_id'))).toBeNull();
    expect(drift(sql, rule('bpp', 'b.sb_company_id'))).toBeNull();
    // own design, else the base's, else SALE_INVOICE (OP-4)
    expect(sql).toMatch(
      inOrder(
        'CASE',
        'WHEN',
        rule('cpp', 'b.sb_company_id'),
        'THEN cpp.ppo_code',
        'WHEN',
        rule('bpp', 'b.sb_company_id'),
        'THEN bpp.ppo_code',
        "ELSE 'SALE_INVOICE'",
        'END AS print_purpose_code',
      ),
    );
  });

  const docsHere = existsSync(DOCS_PRINT_TEMPLATES);
  const docsIt = docsHere ? it : it.skip;
  const skipped = docsHere
    ? ''
    : ` [SKIPPED: ${DOCS_PRINT_TEMPLATES} is not in this checkout (a server-only clone, e.g. CI); the dev workspace runs it]`;

  // doc_title: the type's print title, else the base's, else the name of the
  // design the bill prints with (own, else base, else SALE_INVOICE).
  const docTitleShape = inOrder(
    'WHEN',
    rule('op', 'sb.sb_company_id'),
    'THEN op.ppo_name',
    'WHEN',
    rule('bp', 'sb.sb_company_id'),
    'THEN bp.ppo_name',
    'WHEN vt.vchr_type_id IS NOT NULL THEN (',
  );

  docsIt(
    `the Sales Invoice A5 header dataset (datasets/0-header.sql) holds it in doc_title${skipped}`,
    () => {
      const sql = readDoc(HEADER_DATASET);
      expect(sql).toContain('AS doc_title');
      expect(drift(sql, rule('op', 'sb.sb_company_id'))).toBeNull();
      expect(drift(sql, rule('bp', 'sb.sb_company_id'))).toBeNull();
      expect(sql).toMatch(docTitleShape);
    },
  );

  docsIt(
    `the Sales Invoice A5 deploy SQL (sale-invoice-a5-deploy.sql) carries the same${skipped}`,
    () => {
      const sql = readDoc(DEPLOY_SQL);
      expect(drift(sql, rule('op', 'sb.sb_company_id'))).toBeNull();
      expect(drift(sql, rule('bp', 'sb.sb_company_id'))).toBeNull();
      expect(sql).toMatch(docTitleShape);
    },
  );

  it('the drift report names the line that changed', () => {
    const text = rule('cpp', 'b.sb_company_id');
    const lines = text.split('\n');
    const at4 = `the copy matches the rule's first 3 line(s), then differs at: ${lines[3].trim()}`;
    expect(drift(text, text)).toBeNull();
    // someone edits the fourth line of one copy by hand: inside it, or at its end
    expect(
      drift(
        [...lines.slice(0, 3), lines[3].replace('= true', '= false'), ...lines.slice(4)].join('\n'),
        text,
      ),
    ).toBe(at4);
    expect(
      drift([...lines.slice(0, 3), `${lines[3]} OR true`, ...lines.slice(4)].join('\n'), text),
    ).toBe(at4);
    expect(drift('SELECT 1', text)).toBe(`the rule's first line is not in the copy: ${lines[0]}`);
  });
});
