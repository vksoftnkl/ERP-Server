import { Prisma, PrintTemplateDataset, PrintTemplateVersion } from '@prisma/client';
import { loadCanvasFixture } from '../__fixtures__/load-fixture';
import {
  PrintRenderDefinitionError,
  assertRenderableEngine,
  buildDefinition,
} from './definition-from-version';

/**
 * The bridge between what §3 and §4 store and what the layout engine reads.
 *
 * The invariant under test throughout: THE VERSION WINS. The body owns the
 * bands and nothing else, because a body that could redefine the page would
 * print on stationery the Template tab does not name, and a body that could
 * invent a dataset would bind to a query with no row in
 * print_template_dataset — printing blank, which is the most confusing failure
 * available because the design looks right.
 */

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

/** One band that repeats over `items`, so a definition has something to hold. */
const DETAIL_BAND = {
  type: 'DETAIL',
  dataset: 'items',
  heightMm: 5,
  elements: [{ id: 'e1', kind: 'FIELD', x: 5, y: 0, w: 50, z: 0, value: '{{ row.item_name }}' }],
};

function version(overrides: Partial<PrintTemplateVersion> = {}): PrintTemplateVersion {
  return {
    ptvId: '0196-version',
    ptvTemplateId: '0196-template',
    ptvRevNo: 1,
    ptvStatus: 'PUBLISHED',
    ptvEngine: 'JSON_BANDS',
    // A design with a band on it: the empty stub is a legitimate stored state
    // and is refused in its own right, tested separately below.
    ptvBody: JSON.stringify({ bands: [DETAIL_BAND] }),
    ptvSchemaVer: 1,
    ptvPaperCode: 'A4',
    ptvOrientation: 'PORTRAIT',
    ptvWidthMm: null,
    ptvHeightMm: null,
    ptvMarginTopMm: decimal(10),
    ptvMarginBottomMm: decimal(12),
    ptvMarginLeftMm: decimal(8),
    ptvMarginRightMm: decimal(8),
    ptvColumns: null,
    ptvLang: 'en-IN',
    ptvFontFamily: null,
    ptvParams: null,
    ptvNote: null,
    ptvApprovedOn: null,
    ptvApprovedBy: null,
    ptvIsDeleted: false,
    ptvSyncDate: null,
    ptvCreatedOn: new Date('2026-08-01T00:00:00Z'),
    ptvCreatedBy: null,
    ptvModifiedOn: null,
    ptvModifiedBy: null,
    ...overrides,
  } as PrintTemplateVersion;
}

function dataset(overrides: Partial<PrintTemplateDataset> = {}): PrintTemplateDataset {
  return {
    ptdId: '0196-dataset',
    ptdVersionId: '0196-version',
    ptdRole: 'DETAIL',
    ptdDatasetNo: 1,
    ptdSortOrder: 0,
    ptdName: 'items',
    ptdLabel: null,
    ptdSourceKind: 'PROVIDER',
    ptdProviderCode: 'sales.bill.items',
    ptdSql: null,
    ptdSqlNorm: null,
    ptdRequiresCompany: true,
    ptdParentNo: null,
    ptdLinkFields: null,
    ptdRowLimit: 5000,
    ptdTimeoutMs: 15000,
    ptdRemarks: null,
    ptdIsDeleted: false,
    ptdSyncDate: null,
    ptdCreatedOn: new Date('2026-08-01T00:00:00Z'),
    ptdCreatedBy: null,
    ptdModifiedOn: null,
    ptdModifiedBy: null,
    ...overrides,
  } as PrintTemplateDataset;
}

describe('assertRenderableEngine', () => {
  it('accepts the two engines that have a renderer', () => {
    expect(assertRenderableEngine('JSON_BANDS')).toBe('JSON_BANDS');
    expect(assertRenderableEngine('ESCPOS_TEXT')).toBe('ESCPOS_TEXT');
  });

  it.each(['HTML_CSS', 'QTRPT_XML', 'RAW'])('refuses %s by name and with a reason', (engine) => {
    // ptv_engine is what makes moving off a body format possible without a flag
    // day; the price is that three of its members have no renderer here, and
    // each is refused with the reason rather than with a bare "cannot render".
    try {
      assertRenderableEngine(engine);
      throw new Error('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(PrintRenderDefinitionError);
      const detail = (error as PrintRenderDefinitionError).details[0];
      expect(detail.field).toBe('ptvEngine');
      expect(detail.message).toContain(engine);
      expect(detail.message).toContain('JSON_BANDS');
    }
  });
});

describe('buildDefinition — the version wins', () => {
  it('takes the page from the version, not from the body', () => {
    const built = buildDefinition(
      version({
        ptvPaperCode: 'A5',
        ptvOrientation: 'LANDSCAPE',
        ptvBody: JSON.stringify({
          bands: [DETAIL_BAND],
          // A stale copy of the page, which the canvas round-trips for
          // readability. It must not outrank the Template tab.
          paper: { code: 'A4', widthMm: 210, heightMm: 297, margins: {} },
        }),
      }),
      [dataset()],
    );

    expect(built.definition.paper.code).toBe('A5');
    expect(built.definition.paper.widthMm).toBe(148);
    expect(built.definition.paper.orientation).toBe('LANDSCAPE');
  });

  it('fills page dimensions from the preset only where the version is silent', () => {
    const built = buildDefinition(version({ ptvPaperCode: 'A4', ptvWidthMm: decimal(200) }), [
      dataset(),
    ]);

    expect(built.definition.paper.widthMm).toBe(200);
    expect(built.definition.paper.heightMm).toBe(297);
  });

  it("keeps a site's own paper code rather than renaming it to A4", () => {
    const built = buildDefinition(
      version({
        ptvPaperCode: 'MILL_CHALLAN',
        ptvWidthMm: decimal(190),
        ptvHeightMm: decimal(140),
      }),
      [dataset()],
    );

    expect(built.definition.paper.code).toBe('MILL_CHALLAN');
    expect(built.definition.paper.widthMm).toBe(190);
  });

  it('keeps a null height, because continuous stationery is meaningful', () => {
    const built = buildDefinition(
      version({
        ptvEngine: 'ESCPOS_TEXT',
        ptvPaperCode: 'T80',
        ptvColumns: 48,
        ptvBody: JSON.stringify({
          bands: [{ ...DETAIL_BAND, elements: [{ ...DETAIL_BAND.elements[0], col: 0, row: 0 }] }],
        }),
      }),
      [dataset()],
    );

    expect(built.layoutMode).toBe('GRID');
    expect(built.definition.paper.heightMm).toBeNull();
    expect(built.definition.paper.columns).toBe(48);
  });

  it('takes the datasets from the ptd rows, and gives a SQL dataset a sql.* token', () => {
    const built = buildDefinition(
      version({
        ptvBody: JSON.stringify({ bands: [DETAIL_BAND], datasets: [{ name: 'invented' }] }),
      }),
      [
        dataset({ ptdRole: 'MASTER', ptdDatasetNo: 0, ptdName: 'bill' }),
        dataset({
          ptdName: 'items',
          ptdSourceKind: 'SQL',
          ptdProviderCode: null,
          ptdSql: 'SELECT 1 WHERE c = :company_id',
        }),
      ],
    );

    expect(built.definition.datasets).toEqual([
      { name: 'bill', provider: 'sales.bill.items', cardinality: 'one' },
      { name: 'items', provider: 'sql.items', cardinality: 'many' },
    ]);
  });

  it('derives the layout mode from the engine', () => {
    expect(buildDefinition(version(), [dataset()]).layoutMode).toBe('GRAPHIC');
  });
});

describe('buildDefinition — what it refuses', () => {
  it('refuses the empty stub a new design starts as, in its own words', () => {
    try {
      buildDefinition(version({ ptvBody: JSON.stringify({ bands: [] }) }), [dataset()]);
      throw new Error('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(PrintRenderDefinitionError);
      expect((error as PrintRenderDefinitionError).message).toContain('no design yet');
      // Not the schema's "Too small: expected array to have >=1 items", which
      // sends the reader to count something rather than to draw something.
      expect((error as PrintRenderDefinitionError).details[0].message).toContain('designer');
    }
  });

  it('refuses a body that is not JSON', () => {
    expect(() => buildDefinition(version({ ptvBody: 'not json at all' }), [dataset()])).toThrow(
      /not valid JSON/,
    );
  });

  it('refuses a body that is an array rather than a design', () => {
    expect(() => buildDefinition(version({ ptvBody: '[]' }), [dataset()])).toThrow(/not a design/);
  });

  it('refuses the stub band that crashed a renderer, naming the path', () => {
    // Found exactly this way: ptv_body is a TEXT column whose only check is that
    // a JSON_BANDS body parses as an object, so {"bands":[{"kind":"HEADER"}]} is
    // a legal stored body — and a renderer that trusted it died on
    // band.elements.
    try {
      buildDefinition(version({ ptvBody: JSON.stringify({ bands: [{ kind: 'HEADER' }] }) }), [
        dataset(),
      ]);
      throw new Error('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(PrintRenderDefinitionError);
      expect((error as PrintRenderDefinitionError).details[0].field).toContain('bands.0');
    }
  });

  it('refuses a band bound to a dataset the revision does not declare', () => {
    try {
      buildDefinition(
        version({
          ptvBody: JSON.stringify({ bands: [{ ...DETAIL_BAND, dataset: 'lines' }] }),
        }),
        [dataset({ ptdName: 'items' })],
      );
      throw new Error('should have refused');
    } catch (error) {
      const detail = (error as PrintRenderDefinitionError).details[0];
      // The one that would otherwise print blank: the band binds a name that no
      // print_template_dataset row carries, so it resolves to nothing.
      expect(detail.message).toContain('lines');
    }
  });
});

describe('buildDefinition — the designs the canvas actually produces', () => {
  it('renders a stored GST A4 invoice body against its own version row', () => {
    const fixture = loadCanvasFixture('gst-invoice-a4') as {
      bands: unknown[];
      datasets: { name: string; cardinality: string }[];
    };

    const built = buildDefinition(
      version({ ptvBody: JSON.stringify({ bands: fixture.bands }) }),
      fixture.datasets.map((entry, index) =>
        dataset({
          ptdName: entry.name,
          ptdDatasetNo: entry.cardinality === 'one' && index === 2 ? 0 : index + 1,
          ptdRole: entry.cardinality === 'one' ? 'MASTER' : 'DETAIL',
        }),
      ),
    );

    expect(built.definition.bands.length).toBe(fixture.bands.length);
    expect(built.layoutMode).toBe('GRAPHIC');
  });
});
