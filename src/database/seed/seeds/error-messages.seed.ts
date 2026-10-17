import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type { TsSeed } from '../seed.types';

/** The catalogue file, beside the SQL seeds (the runner reads only *.sql from there). */
const FILE = 'Error_Messages.json';

interface CatalogueFile {
  version: string;
  rows: {
    code: string;
    variant?: string | null;
    lang?: string | null;
    title: string;
    line: string;
    todo: string;
  }[];
}

/** prisma/seed from the cwd (PM2 starts at the app root) or from this file (dist/src/…, src/…). */
function cataloguePath(): string | null {
  const candidates = [
    resolve(process.cwd(), 'prisma', 'seed', FILE),
    resolve(__dirname, '..', '..', '..', '..', 'prisma', 'seed', FILE),
    resolve(__dirname, '..', '..', '..', '..', '..', 'prisma', 'seed', FILE),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function readCatalogue(): CatalogueFile | null {
  const path = cataloguePath();
  if (!path) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as CatalogueFile;
  if (typeof parsed.version !== 'string' || !Array.isArray(parsed.rows)) {
    throw new Error(`${FILE}: expected { version, rows[] }`);
  }
  return parsed;
}

/**
 * Notes 120 — the plain error wording, loaded from prisma/seed/Error_Messages.json
 * into fixed.error_message. The file is the whole catalogue the user approved
 * (the share's wording files): every row of it is upserted by (code, variant,
 * lang) and active; a row the file no longer carries is deactivated, never
 * deleted. The version goes to fixed.error_message_catalogue, where a running
 * server notices it within a minute and reloads its wording.
 *
 * `once` keyed on the file's version: replace the file with a new version, and
 * the next seed run (boot under DB_AUTO_SEED, or `npm run seed:run --
 * --only=error-messages`) loads it.
 */
export const errorMessagesSeed: TsSeed = {
  name: 'error-messages',
  get version(): string {
    return readCatalogue()?.version ?? 'missing';
  },
  mode: 'once',
  description: 'Plain error wording (notes 120) from prisma/seed/Error_Messages.json',
  async run(prisma: PrismaClient): Promise<void> {
    const catalogue = readCatalogue();
    if (!catalogue) {
      return;
    }
    const rows = catalogue.rows.map((r) => ({
      code: r.code.trim(),
      variant: (r.variant ?? '').trim(),
      lang: (r.lang ?? 'en').trim() || 'en',
      title: r.title.trim(),
      line: r.line.trim(),
      todo: r.todo.trim(),
    }));
    const now = new Date();
    await prisma.$transaction(
      async (tx) => {
        for (const r of rows) {
          await tx.errorMessage.upsert({
            where: {
              ermCode_ermVariant_ermLang: {
                ermCode: r.code,
                ermVariant: r.variant,
                ermLang: r.lang,
              },
            },
            create: {
              ermCode: r.code,
              ermVariant: r.variant,
              ermLang: r.lang,
              ermTitle: r.title,
              ermLine: r.line,
              ermTodo: r.todo,
            },
            update: {
              ermTitle: r.title,
              ermLine: r.line,
              ermTodo: r.todo,
              ermIsActive: true,
              ermModifiedOn: now,
            },
          });
        }
        const kept = new Set(rows.map((r) => `${r.code}|${r.variant}|${r.lang}`));
        const live = await tx.errorMessage.findMany({
          where: { ermIsActive: true },
          select: { ermId: true, ermCode: true, ermVariant: true, ermLang: true },
        });
        const gone = live.filter((r) => !kept.has(`${r.ermCode}|${r.ermVariant}|${r.ermLang}`));
        if (gone.length > 0) {
          await tx.errorMessage.updateMany({
            where: { ermId: { in: gone.map((r) => r.ermId) } },
            data: { ermIsActive: false, ermModifiedOn: now },
          });
        }
        await tx.errorMessageCatalogue.upsert({
          where: { emcId: 1 },
          create: { emcId: 1, emcVersion: catalogue.version, emcRowCount: rows.length },
          update: { emcVersion: catalogue.version, emcRowCount: rows.length, emcLoadedOn: now },
        });
      },
      { timeout: 60_000 },
    );
  },
};
