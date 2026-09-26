import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The canvas's own designs, as test fixtures.
 *
 * `gst-invoice-a4.json`, `thermal-receipt-t80.json` and
 * `quotation-rate-matrix-a4.json` are copied VERBATIM from
 * `ERP client/features/print-designer/lib/__fixtures__/`. Their provenance is
 * the whole point of having them: they are bodies the designer actually
 * produces, so a test that parses, lays out and renders one is evidence about
 * the real contract rather than about a second copy of this server's opinion.
 *
 * Read from disk rather than `import`ed, so the repository's tsconfig does not
 * need `resolveJsonModule` and the build does not need a JSON asset rule. They
 * are test-only; nothing in the render path reads them.
 */
export type CanvasFixtureName =
  | 'gst-invoice-a4'
  | 'thermal-receipt-t80'
  | 'quotation-rate-matrix-a4';

export function loadCanvasFixture(name: CanvasFixtureName): unknown {
  return JSON.parse(readFileSync(join(__dirname, `${name}.json`), 'utf8')) as unknown;
}

/**
 * The sample datasets a fixture is meant to be rendered with.
 *
 * Only the crosstab design carries one: its whole point is a table whose shape
 * the DATA decides, so a render test with no rows would assert nothing about
 * the thing under test.
 */
export function loadCanvasFixtureSample(name: 'quotation-rate-matrix-a4'): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, `${name}.sample.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}
