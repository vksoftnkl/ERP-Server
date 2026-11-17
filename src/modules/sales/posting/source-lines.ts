import { Prisma } from '@prisma/client';

/**
 * User 2026-11-17 (P4) — ONE answer to "which order line (or challan line)
 * did this document line come from", for the challan and the bill alike.
 *
 * A line may name its source three ways:
 *  - by the source line's own id (`…SrcItemId`) — the Qt screens send it;
 *  - by the source document and the line number (`…SrcDocId` + `…SrcLineNo`);
 *  - by the line's id in `…SrcDocId` (the line grain the order recompute
 *    already accepted).
 * Whatever it sent, a line that resolves leaves here with all four filled
 * from the source line itself — line id, document id, line number, the
 * document's own year — so every reader downstream (the guards, the order
 * draw-down, the reservations, the billed money, the fulfilment) finds it by
 * the id, and they agree. The id wins where the body disagrees with itself,
 * as the order recompute reads it. A reference that does not resolve is left
 * as sent; its index comes back in `unresolved` (a challan guard refuses it).
 *
 * A challan named by document + line number resolves only when that line
 * number is one live row (a batch split shares it); the Qt sends the id.
 */
export type SourceKind = 'SALES_ORDER' | 'DELIVERY_CHALLAN';

export interface SourceKeys {
  type: string;
  docId: string;
  accYear: string;
  lineNo: string;
  itemId: string;
}

/** sale_dc_item's source columns (a challan line's order line). */
export const DC_SOURCE_KEYS: SourceKeys = {
  type: 'sdiSrcDocType',
  docId: 'sdiSrcDocId',
  accYear: 'sdiSrcDocAccYear',
  lineNo: 'sdiSrcLineNo',
  itemId: 'sdiSrcItemId',
};

/** sale_bill_item's source columns (a bill line's order line or challan line). */
export const BILL_SOURCE_KEYS: SourceKeys = {
  type: 'sbiSrcDocType',
  docId: 'sbiSrcDocId',
  accYear: 'sbiSrcDocYear',
  lineNo: 'sbiSrcDocLineNo',
  itemId: 'sbiSrcItemId',
};

interface SourceLine {
  id: string;
  doc_id: string;
  line_no: number;
  acc_year: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOf = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null);
const lineNoOf = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

async function sourceLinesOf(
  tx: Prisma.TransactionClient,
  kind: SourceKind,
  ids: string[],
): Promise<SourceLine[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows =
    kind === 'SALES_ORDER'
      ? await tx.$queryRaw<SourceLine[]>`
          SELECT soi_id AS id, soi_order_id AS doc_id, soi_line_no AS line_no, soi_acc_year AS acc_year
            FROM sales.sale_order_item
           WHERE (soi_id = ANY(${ids}::uuid[]) OR soi_order_id = ANY(${ids}::uuid[]))
             AND soi_is_deleted = false`
      : await tx.$queryRaw<SourceLine[]>`
          SELECT sdi_id AS id, sdi_dc_id AS doc_id, sdi_line_no AS line_no, sdi_acc_year AS acc_year
            FROM sales.sale_dc_item
           WHERE (sdi_id = ANY(${ids}::uuid[]) OR sdi_dc_id = ANY(${ids}::uuid[]))
             AND sdi_is_deleted = false`;
  return (rows ?? []).filter((r) => typeof r?.id === 'string' && typeof r.doc_id === 'string');
}

export async function resolveSourceLines(
  tx: Prisma.TransactionClient,
  lines: readonly Record<string, unknown>[] | undefined,
  keys: SourceKeys,
  kinds: readonly SourceKind[],
): Promise<{ unresolved: number[]; changed: number[] }> {
  const unresolved: number[] = [];
  const changed: number[] = [];
  const list = lines ?? [];
  for (const kind of kinds) {
    const mine = list
      .map((l, idx) => ({ l, idx }))
      .filter(({ l }) => l[keys.type] === kind);
    if (mine.length === 0) {
      continue;
    }
    const ids = [
      ...new Set(
        mine.flatMap(({ l }) => [uuidOf(l[keys.itemId]), uuidOf(l[keys.docId])]).filter((v): v is string => !!v),
      ),
    ];
    const found = await sourceLinesOf(tx, kind, ids);
    const byId = new Map(found.map((r) => [r.id, r]));
    const byDocLine = new Map<string, SourceLine | null>();
    for (const r of found) {
      const k = `${r.doc_id}|${r.line_no}`;
      byDocLine.set(k, byDocLine.has(k) ? null : r);
    }
    for (const { l, idx } of mine) {
      const itemId = uuidOf(l[keys.itemId]);
      const docId = uuidOf(l[keys.docId]);
      const lineNo = lineNoOf(l[keys.lineNo]);
      const r =
        (itemId ? byId.get(itemId) : undefined) ??
        (docId ? byId.get(docId) : undefined) ??
        (docId !== null && lineNo !== null ? byDocLine.get(`${docId}|${lineNo}`) ?? undefined : undefined);
      if (!r) {
        if (itemId || docId) {
          unresolved.push(idx);
        }
        continue;
      }
      const year = (r.acc_year ?? '').trim() || (l[keys.accYear] as string | null) || null;
      if (
        l[keys.itemId] !== r.id ||
        l[keys.docId] !== r.doc_id ||
        lineNoOf(l[keys.lineNo]) !== r.line_no ||
        l[keys.accYear] !== year
      ) {
        changed.push(idx);
      }
      l[keys.itemId] = r.id;
      l[keys.docId] = r.doc_id;
      l[keys.lineNo] = r.line_no;
      l[keys.accYear] = year;
    }
  }
  return { unresolved, changed };
}
