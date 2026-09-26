import { PrintTemplateDataset, PrintTemplateVersion } from '@prisma/client';
import { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import {
  LAYOUT_MODE_FOR_ENGINE,
  RENDERABLE_ENGINES,
  RenderableEngine,
} from '../print-render.constants';
import { DEFAULT_PAPER, findPaperPreset } from './paper-presets';
import {
  TemplateDefinition,
  TemplateDefinitionInput,
  templateDefinitionSchema,
} from './template-definition.schema';

/**
 * A stored revision, as something the layout engine can lay out.
 *
 * ── WHICH SIDE OWNS WHAT ───────────────────────────────────────────────────
 *
 * The version wins for the page and the datasets; the body wins only for the
 * bands:
 *
 *   paper     ← print_template_version.ptv_*        (§3, "The page")
 *   datasets  ← print_template_dataset rows          (§4, where rows come from)
 *   bands     ← ptv_body                             (the canvas's own work)
 *
 * That is the SAME division the client's `canvasBridge.toTemplateDefinition`
 * applies on the way into the designer, and it has to be, or the two ends of
 * one design disagree about what they are describing. A body that redefined the
 * paper would print on stationery the Template tab does not name; a body that
 * invented a dataset would bind to a query with no row in
 * print_template_dataset, so it would resolve to nothing at render and print
 * blank — the most confusing failure available, because the design looks right.
 *
 * A divergence always resolves in favour of the version. The body's own `paper`
 * and `datasets` keys, which the canvas round-trips for readability, are read
 * and discarded here.
 *
 * ── WHAT THIS REFUSES ──────────────────────────────────────────────────────
 *
 * ptv_body is a TEXT column whose only database check is that a JSON_BANDS body
 * parses as a JSON object. Nothing says its bands are the canvas's bands, so
 * `{"bands":[{"kind":"HEADER"}]}` is a perfectly legal stored body and a
 * renderer that trusted it would crash on `band.elements`. Everything here goes
 * through the zod schema, and a body that does not satisfy it is refused with
 * the JSON path that failed rather than rendered half way.
 */

export interface DefinitionBuildResult {
  readonly definition: TemplateDefinition;
  readonly layoutMode: 'GRAPHIC' | 'GRID';
  readonly engine: RenderableEngine;
}

/** Thrown with the field paths a caller can show against the form that failed. */
export class PrintRenderDefinitionError extends Error {
  constructor(
    message: string,
    readonly details: ModuleErrorDetail[],
  ) {
    super(message);
    this.name = 'PrintRenderDefinitionError';
  }
}

/** Prisma hands Decimal columns back as Decimal; the schema wants numbers. */
const toMm = (value: { toNumber(): number } | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
};

const toMmOrZero = (value: { toNumber(): number } | number | null | undefined): number =>
  toMm(value) ?? 0;

/**
 * The engine, checked before anything else is attempted.
 *
 * ptv_engine is what makes moving off a body format possible without a flag day
 * — 3.0 had no such column, so "the body is QtRPT XML" lived in C++ — and the
 * price of that freedom is that three of its five members have no renderer
 * here. Each is refused by name and by reason, because "cannot render" with no
 * subject sends the operator to the wrong screen.
 */
export function assertRenderableEngine(engine: string): RenderableEngine {
  if ((RENDERABLE_ENGINES as readonly string[]).includes(engine)) {
    return engine as RenderableEngine;
  }

  const reason: Record<string, string> = {
    HTML_CSS:
      'an HTML body needs a browser to lay out, and this server deliberately does not embed one',
    QTRPT_XML:
      "3.0's report format is kept so a migration can read it, and is not rendered directly",
    RAW: 'a RAW body is bytes the server must not interpret — send it to the device unchanged',
  };

  throw new PrintRenderDefinitionError(
    `This revision cannot be rendered: its engine is ${engine}`,
    [
      {
        field: 'ptvEngine',
        message:
          `${engine} has no renderer — ${reason[engine] ?? 'it is not a format this server draws'}. ` +
          `Renderable engines are ${RENDERABLE_ENGINES.join(' and ')}.`,
      },
    ],
  );
}

/** The stored body, parsed. A body that is not JSON is a refusal, not an empty design. */
function parseBody(
  version: Pick<PrintTemplateVersion, 'ptvBody' | 'ptvId'>,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(version.ptvBody) as unknown;
  } catch (error) {
    throw new PrintRenderDefinitionError('The stored design is not valid JSON', [
      {
        field: 'ptvBody',
        message:
          `Revision ${version.ptvId} holds a body that does not parse as JSON: ` +
          `${error instanceof Error ? error.message : String(error)}. ` +
          'Open it in the designer and save it again.',
      },
    ]);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new PrintRenderDefinitionError('The stored design is not a design', [
      {
        field: 'ptvBody',
        message:
          'A JSON_BANDS body must be a JSON OBJECT holding a `bands` array. ' +
          `This one is ${Array.isArray(parsed) ? 'an array' : typeof parsed}.`,
      },
    ]);
  }

  return parsed as Record<string, unknown>;
}

/**
 * The page, from the version.
 *
 * A preset fills in only what the version leaves NULL. `heightMm: null` is
 * MEANINGFUL — continuous stationery, a thermal roll — so it survives when the
 * version states it and is only filled from the preset when the version says
 * nothing at all, which is why this reads the column rather than a falsy check.
 */
function paperFor(version: PrintTemplateVersion): TemplateDefinitionInput['paper'] {
  const preset = findPaperPreset(version.ptvPaperCode) ?? DEFAULT_PAPER;
  const widthMm = toMm(version.ptvWidthMm) ?? preset.widthMm;
  const heightMm = version.ptvHeightMm !== null ? toMm(version.ptvHeightMm) : preset.heightMm;
  const columns = version.ptvColumns ?? preset.columns;

  return {
    // The stored code wins even when no preset matched it: a site's own paper
    // is a real code, and renaming it to A4 in the renderer would be a lie.
    code: version.ptvPaperCode || preset.code,
    widthMm,
    heightMm,
    orientation: version.ptvOrientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT',
    margins: {
      top: toMmOrZero(version.ptvMarginTopMm),
      right: toMmOrZero(version.ptvMarginRightMm),
      bottom: toMmOrZero(version.ptvMarginBottomMm),
      left: toMmOrZero(version.ptvMarginLeftMm),
    },
    ...(columns !== undefined && columns !== null ? { columns } : {}),
    ...(preset.rows !== undefined ? { rows: preset.rows } : {}),
  };
}

/**
 * The datasets, from the ptd rows.
 *
 * `provider` here is the layout engine's binding TOKEN, not §4's provider code:
 * a SQL dataset has no provider code at all, so it is given `sql.<name>` — the
 * same token the client's `canvasBridge.sqlToken` shows in the designer's data
 * panel. Nothing downstream of this dispatches on it; the runner reads the ptd
 * row itself. It exists so the two ends agree on what to call a thing.
 */
function datasetsFor(
  datasets: readonly PrintTemplateDataset[],
): TemplateDefinitionInput['datasets'] {
  return datasets.map((dataset) => ({
    name: dataset.ptdName,
    provider:
      dataset.ptdSourceKind === 'SQL'
        ? `sql.${dataset.ptdName}`
        : (dataset.ptdProviderCode ?? `sql.${dataset.ptdName}`),
    cardinality: dataset.ptdRole === 'MASTER' ? ('one' as const) : ('many' as const),
  }));
}

export function buildDefinition(
  version: PrintTemplateVersion,
  datasets: readonly PrintTemplateDataset[],
): DefinitionBuildResult {
  const engine = assertRenderableEngine(version.ptvEngine);
  const layoutMode = LAYOUT_MODE_FOR_ENGINE[engine];
  const body = parseBody(version);

  const candidate: TemplateDefinitionInput = {
    // ptv_schema_ver is the VERSION ROW's declaration of the body's schema;
    // the definition carries its own. They are the same number by construction
    // and the row is the one a migration would read, so the row wins.
    schemaVersion: version.ptvSchemaVer,
    layoutMode,
    ...(typeof body.meta === 'object' && body.meta !== null && !Array.isArray(body.meta)
      ? { meta: body.meta as Record<string, unknown> }
      : {}),
    paper: paperFor(version),
    datasets: datasetsFor(datasets),
    // The one thing the body owns. Left exactly as stored: the schema is what
    // decides whether it is a design, and repairing it here would hide the
    // repair from the person who has to fix the design.
    bands: (body.bands ?? []) as TemplateDefinitionInput['bands'],
  };

  // The empty stub a new design starts life as, answered in its own words. It
  // is the most common state a body is ever in, and the schema's own account of
  // it — "Too small: expected array to have >=1 items" — sends the reader to
  // count something rather than to draw something.
  if (!Array.isArray(candidate.bands) || candidate.bands.length === 0) {
    throw new PrintRenderDefinitionError('This revision has no design yet', [
      {
        field: 'bands',
        message:
          `Revision ${version.ptvRevNo} holds no bands, which is what a design looks like before ` +
          'anything has been drawn on it. Open it in the designer, add at least one band, and ' +
          'save.',
      },
    ]);
  }

  const parsed = templateDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PrintRenderDefinitionError(
      'The stored design cannot be rendered as it stands',
      parsed.error.issues.map((issue) => ({
        // The path is into the DEFINITION, which is what the designer shows —
        // `bands[2].elements[7].value` names a box on the canvas, where
        // `ptvBody` names a 40 KB text column.
        field: issue.path.length > 0 ? issue.path.join('.') : 'ptvBody',
        message: issue.message,
      })),
    );
  }

  return { definition: parsed.data, layoutMode, engine };
}

/**
 * The same build, from a body held in hand rather than one stored.
 *
 * This is what makes the designer's Preview honest about an unsaved change
 * while keeping the version the authority: the caller supplies BANDS, and the
 * paper and datasets still come from the revision. A canvas cannot preview
 * against a page or a query the saved revision does not have, so what Preview
 * shows differs from what Print produces by exactly the bands the operator is
 * looking at — and by nothing else.
 */
export function buildDefinitionFromBody(
  version: PrintTemplateVersion,
  datasets: readonly PrintTemplateDataset[],
  body: Record<string, unknown>,
): DefinitionBuildResult {
  return buildDefinition({ ...version, ptvBody: JSON.stringify(body) }, datasets);
}
