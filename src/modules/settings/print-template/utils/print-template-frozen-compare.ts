import { Prisma } from '@prisma/client';

/**
 * A PUBLISHED / RETIRED revision is frozen. A client that retires it may send the whole design back with
 * ptvStatus 'RETIRED' (the web Designer does): the server compares, and only a field whose sent value DIFFERS
 * from the stored one is a change (user 2026-10-29, "server compares").
 *
 * Normalised compare:
 *  - undefined = not sent (never a change); null and '' / blank text are the same "no value";
 *  - numbers as decimals (10 = 10.00 = Decimal('10'));
 *  - JSON (ptvParams; a body that parses as JSON) deep-equal, key order ignored;
 *  - any other text exactly.
 */

type Loose = Record<string, unknown>;

const isBlank = (v: unknown) => v === null || (typeof v === 'string' && v.trim() === '');

/** Key order ignored; numbers by value. */
export function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => jsonDeepEqual(x, b[i]));
  const ka = Object.keys(a as Loose).filter((k) => (a as Loose)[k] !== undefined).sort();
  const kb = Object.keys(b as Loose).filter((k) => (b as Loose)[k] !== undefined).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && jsonDeepEqual((a as Loose)[k], (b as Loose)[k]));
}

const parseJson = (v: unknown): { ok: boolean; value: unknown } => {
  if (typeof v !== 'string') return { ok: true, value: v };
  try { return { ok: true, value: JSON.parse(v) }; } catch { return { ok: false, value: undefined }; }
};

function decimalOf(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined || v === '') return null;
  try { return new Prisma.Decimal(v as Prisma.Decimal.Value); } catch { return null; }
}

export type CompareKind = 'text' | 'number' | 'json' | 'body';

/** Does the sent value differ from the stored one? `sent` undefined = not sent = no. */
export function sentValueDiffers(kind: CompareKind, sent: unknown, stored: unknown): boolean {
  if (sent === undefined) return false;
  if (isBlank(sent) && isBlank(stored ?? null)) return false;
  switch (kind) {
    case 'number': {
      const a = decimalOf(sent), b = decimalOf(stored);
      if (a === null || b === null) return !(a === null && b === null);
      return !a.equals(b);
    }
    case 'json': {
      const a = parseJson(sent), b = parseJson(stored);
      if (!a.ok || !b.ok) return sent !== stored;
      return !jsonDeepEqual(a.value ?? null, b.value ?? null);
    }
    case 'body': {
      if (sent === stored) return false;
      // a body that is JSON on both sides (JSON_BANDS) is compared as JSON — a client that re-serialised it is not a change
      const a = parseJson(sent), b = parseJson(stored);
      if (a.ok && b.ok && typeof sent === 'string' && typeof stored === 'string') return !jsonDeepEqual(a.value, b.value);
      return true;
    }
    default: {
      const a = typeof sent === 'string' ? sent.trim() : sent;
      const b = typeof stored === 'string' ? stored.trim() : stored ?? null;
      return a !== b;
    }
  }
}

/** The design fields of a revision and how each is compared. */
export const VERSION_DESIGN_COMPARE: Record<string, CompareKind> = {
  ptvRevNo: 'number', ptvEngine: 'text', ptvBody: 'body', ptvSchemaVer: 'number', ptvPaperCode: 'text', ptvOrientation: 'text',
  ptvWidthMm: 'number', ptvHeightMm: 'number', ptvMarginTopMm: 'number', ptvMarginBottomMm: 'number', ptvMarginLeftMm: 'number',
  ptvMarginRightMm: 'number', ptvColumns: 'number', ptvLang: 'text', ptvFontFamily: 'text', ptvParams: 'json', ptvNote: 'text',
};

/** Of the design keys a row SENT, those whose value differs from the stored revision. */
export function changedVersionKeys(row: object, stored: object, sentKeys: string[]): string[] {
  return sentKeys.filter((k) => sentValueDiffers(VERSION_DESIGN_COMPARE[k] ?? 'text', (row as Loose)[k], (stored as Loose)[k]));
}

/** The dataset fields compared (audit stamps are not part of the design). */
export const DATASET_COMPARE: Record<string, CompareKind> = {
  ptdRole: 'text', ptdDatasetNo: 'number', ptdSortOrder: 'number', ptdName: 'text', ptdLabel: 'text', ptdSourceKind: 'text',
  ptdProviderCode: 'text', ptdSql: 'text', ptdParentNo: 'number', ptdLinkFields: 'text', ptdRowLimit: 'number', ptdTimeoutMs: 'number',
  ptdRemarks: 'text',
};

/**
 * A sent `datasets` array against the revision's live datasets: the same set (every row names an existing ptdId,
 * one each, none left out, none deleted) with no sent field different. Returns the first difference, or null.
 */
export function datasetsDifference(sent: object[], stored: object[]): string | null {
  if (sent.length !== stored.length) return `${sent.length} datasets sent, ${stored.length} stored`;
  const byId = new Map(stored.map((d) => [(d as Loose).ptdId as string, d]));
  const seen = new Set<string>();
  for (let i = 0; i < sent.length; i++) {
    const r = sent[i] as Loose;
    const id = r.ptdId as string | undefined;
    if (!id || !byId.has(id) || seen.has(id)) return `datasets[${i}] is not one of the stored datasets`;
    seen.add(id);
    if (r.ptdIsDeleted === true) return `datasets[${i}] would be deleted`;
    const s = byId.get(id)!;
    const k = Object.keys(DATASET_COMPARE).find((key) => sentValueDiffers(DATASET_COMPARE[key], r[key], (s as Loose)[key]));
    if (k) return `datasets[${i}].${k}`;
  }
  return null;
}
