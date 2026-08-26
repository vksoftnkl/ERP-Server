import type { Prisma, PrismaClient } from '@prisma/client';
import { GALLERY_TEMPLATES } from '../../../modules/reporting/templates/gallery/gallery.index';
import { templateDefinitionSchema } from '../../../modules/reporting/templates/dto/template-definition.schema';
import type { TsSeed } from '../seed.types';

/**
 * Seeds the shipped template gallery as SYSTEM templates (pt_company_id NULL).
 *
 * ── Why this is a TypeScript seed rather than SQL ───────────────────────────
 * The definitions are built by TypeScript functions that derive their column
 * grids arithmetically, and each is validated against the zod contract before
 * it is written. A SQL seed would have to carry forty pre-computed
 * x-coordinates per template as a literal blob, with no way to catch a
 * definition that the engine would reject until a customer tried to print.
 *
 * ── Idempotence, and what it deliberately does NOT do ───────────────────────
 * The seed runs on every deploy (`mode: 'always'`). It:
 *
 *   * INSERTS a gallery template that is not present, and
 *   * UPDATES one whose stored definition differs from the shipped one, bumping
 *     its version and archiving the old body as a revision.
 *
 * It never touches a TENANT template. A customer's clone is their work product;
 * an upgrade that silently rewrote it would discard customisation the customer
 * paid for. That is the whole reason system templates are read-only and cloning
 * is the editing path.
 */

/**
 * A stable, order-independent serialisation, for comparing a stored definition
 * against the shipped one.
 *
 * Two things make a naive JSON.stringify comparison report "changed" on every
 * single deploy — bumping every template version and writing a revision row
 * each time, forever:
 *
 *   * Postgres `jsonb` does not preserve KEY ORDER; it stores keys sorted.
 *   * jsonb normalises a NUMBER to 15 significant digits. A coordinate computed
 *     as `8 + 9 * 3.4` is 38.599999999999994 in JavaScript and comes back as
 *     38.59999999999999 — a difference of one digit of floating-point dust,
 *     five orders of magnitude below anything a printer can resolve.
 *
 * So keys are sorted and numbers rounded to 6 decimals, which is far finer than
 * the 0.1mm a coordinate means and far coarser than the dust.
 */
const COORDINATE_PRECISION = 1e6;

const canonicalise = (value: unknown): unknown => {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION
      : value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalise(entry)]),
    );
  }
  return value;
};

const sameDefinition = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonicalise(left)) === JSON.stringify(canonicalise(right));

/** Stable identity: a gallery key lives in the definition's meta block. */
const galleryKeyOf = (definition: unknown): string | null => {
  if (definition === null || typeof definition !== 'object') {
    return null;
  }
  const meta = (definition as { meta?: unknown }).meta;
  if (meta === null || typeof meta !== 'object') {
    return null;
  }
  const key = (meta as { gallery?: unknown }).gallery;
  return typeof key === 'string' ? key : null;
};

export const reportTemplatesSeed: TsSeed = {
  name: 'report-template-gallery',
  // Bump whenever a gallery template changes, so `once` deployments re-run it.
  version: '1.0.0',
  mode: 'always',
  description: 'System print templates: A4/A5 GST invoice, 58/80mm thermal, dot matrix, statement',

  async run(prisma: PrismaClient): Promise<void> {
    for (const entry of GALLERY_TEMPLATES) {
      // Validate before writing. A gallery template that fails here is a build
      // error we want at deploy time, not a 500 at a customer's counter.
      const parsed = templateDefinitionSchema.safeParse(entry.build());

      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ');
        throw new Error(`Gallery template '${entry.key}' is not valid: ${issues}`);
      }

      const definition = parsed.data;
      const definitionJson = definition as unknown as Prisma.InputJsonValue;

      // Find the existing system row by gallery key rather than by name: a
      // release may rename a template, and matching on name would then seed a
      // duplicate alongside the old one.
      const systemTemplates = await prisma.printTemplate.findMany({
        where: {
          ptCompanyId: null,
          ptDocType: entry.docType,
          ptOutputMode: entry.outputMode,
          ptPaperCode: entry.paperCode,
          ptIsDeleted: false,
        },
      });

      const existing = systemTemplates.find(
        (template) => galleryKeyOf(template.ptDefinition) === entry.key,
      );

      if (!existing) {
        await prisma.$transaction(async (transaction) => {
          if (entry.isDefault) {
            // ux_pt_default is UNIQUE NULLS NOT DISTINCT, so a second default
            // for the same system scope is a constraint violation rather than a
            // silent double. Clear first, inside the same transaction.
            await transaction.printTemplate.updateMany({
              where: {
                ptCompanyId: null,
                ptBranchId: null,
                ptDocType: entry.docType,
                ptOutputMode: entry.outputMode,
                ptPaperCode: entry.paperCode,
                ptIsDefault: true,
                ptIsDeleted: false,
              },
              data: { ptIsDefault: false },
            });
          }

          await transaction.printTemplate.create({
            data: {
              ptCompanyId: null,
              ptBranchId: null,
              ptDocType: entry.docType,
              ptOutputMode: entry.outputMode,
              ptPaperCode: entry.paperCode,
              ptName: entry.name,
              ptVersion: 1,
              ptSchemaVer: definition.schemaVersion,
              ptDefinition: definitionJson,
              ptIsDefault: entry.isDefault,
              ptIsActive: true,
            },
          });
        });

        console.log(`[seed] report template '${entry.key}' created`);
        continue;
      }

      // Canonical comparison — see canonicalise() for why a plain stringify is
      // not enough against a jsonb column.
      const unchanged = sameDefinition(existing.ptDefinition, definition);

      if (unchanged && existing.ptName === entry.name) {
        continue;
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.printTemplateRevision.create({
          data: {
            ptrTemplateId: existing.ptId,
            ptrVersion: existing.ptVersion,
            ptrSchemaVer: existing.ptSchemaVer,
            ptrDefinition: existing.ptDefinition as Prisma.InputJsonValue,
            ptrNote: `superseded by gallery seed v${reportTemplatesSeed.version}`,
          },
        });

        await transaction.printTemplate.update({
          where: { ptId: existing.ptId },
          data: {
            ptName: entry.name,
            ptDefinition: definitionJson,
            ptSchemaVer: definition.schemaVersion,
            ptVersion: existing.ptVersion + 1,
            ptModifiedOn: new Date(),
          },
        });
      });

      console.log(
        `[seed] report template '${entry.key}' updated to version ${existing.ptVersion + 1}`,
      );
    }
  },
};
