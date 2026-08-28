import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The canvas's own designs, as test fixtures.
 *
 * `gst-invoice-a4.json` and `thermal-receipt-t80.json` are copied VERBATIM from
 * `ERP client/features/print-designer/lib/__fixtures__/`. Their provenance is
 * the whole point of having them: they are bodies the designer actually
 * produces, so a test that parses, lays out and renders one is evidence about
 * the real contract rather than about a second copy of this server's opinion.
 *
 * Read from disk rather than `import`ed, so the repository's tsconfig does not
 * need `resolveJsonModule` and the build does not need a JSON asset rule. They
 * are test-only; nothing in the render path reads them.
 */
export function loadCanvasFixture(name: 'gst-invoice-a4' | 'thermal-receipt-t80'): unknown {
  return JSON.parse(readFileSync(join(__dirname, `${name}.json`), 'utf8')) as unknown;
}
