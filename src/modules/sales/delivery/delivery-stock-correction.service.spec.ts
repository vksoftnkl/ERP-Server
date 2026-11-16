import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DN_RELOT_RULES,
  DN_TRANSFER_RULES,
  DeliveryStockCorrectionService,
  type CorrectionLine,
} from './delivery-stock-correction.service';

const D = (v: number) => new Prisma.Decimal(v);
const G1 = '01a1e000-0000-7000-8000-0000000000g1'.replace('g1', '01');
const G2 = '01a1e000-0000-7000-8000-000000000002';
const LOT_A = '01a1e000-0000-7000-8000-00000000000a';
const LOT_C = '01a1e000-0000-7000-8000-00000000000c';

const doc = {
  sdnId: '01a1e000-0000-7000-8000-0000000000d1',
  noteAccYear: '2026-2027',
  shadowAccYear: '2026-2027',
  companyId: 'co',
  branchId: 'br',
  tenantId: null,
  deviceId: 'dev',
  refno: 'DN/2026-2027/D3/00042',
  docDate: '2026-11-15',
  docDatetime: new Date('2026-11-15T09:00:00Z'),
};

const ln = (over: Partial<CorrectionLine> = {}): CorrectionLine => ({
  lineNo: 1,
  itemId: 'item',
  iucId: 'iuc',
  factor: D(1),
  qty: D(5),
  givingGodownId: G1,
  billGodownId: G1,
  givenLotId: LOT_A,
  billLotId: LOT_A,
  bucket: 'SALEABLE',
  ...over,
});

/** A tx that records every shadow header / line written. */
function harness() {
  const headers: { type: string; from: string; to: string | null; reason: string | null; refno: string }[] = [];
  const lines: unknown[][] = [];
  let seq = 0;
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('FROM stock.stock_reason_master')) {
        return [
          { srm_id: 'r-out', srm_code: 'RELOT_OUT' },
          { srm_id: 'r-in', srm_code: 'RELOT_IN' },
          { srm_id: 'r-gd', srm_code: 'DELIVERY_GODOWN' },
        ];
      }
      if (sql.includes('FROM inventory.item_unit_conversion iuc')) {
        return [{ iuc_id: 'iuc', base_iuc_id: 'iuc' }];
      }
      if (sql.includes('pg_advisory_xact_lock') || sql.includes('MAX(svh_slno)')) {
        return [{ next_slno: BigInt(1) }];
      }
      if (sql.includes('count(*)::int + 1 AS n')) {
        return [{ n: ++seq }];
      }
      if (sql.includes('INSERT INTO stock.stock_voucher (')) {
        headers.push({
          type: values[5] as string,
          refno: values[7] as string,
          from: values[11] as string,
          to: values[12] as string | null,
          reason: values[13] as string | null,
        });
        return [{ svh_id: `svh-${headers.length}` }];
      }
      return [];
    }),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      lines.push(values);
      return 1;
    }),
  };
  const posting = { post: jest.fn().mockResolvedValue({}), cancel: jest.fn().mockResolvedValue(2) };
  const svc = new DeliveryStockCorrectionService(posting as never);
  return { tx, svc, posting, headers, lines };
}

/** The (godown, lot, reason, direction) of every shadow line, in order, read off the bound values. */
function shadowLines(lines: unknown[][]) {
  // Each INSERT binds one Prisma.join of the rows: 20 values per row.
  return lines.flatMap((vals) => {
    const v = ((vals[0] as { values?: unknown[] }).values ?? []) as unknown[];
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < v.length; i += 20) {
      rows.push({ godown: v[i + 10], lot: v[i + 11], qty: String(v[i + 13]), reason: v[i + 15], direction: v[i + 16] });
    }
    return rows;
  });
}

describe('DeliveryStockCorrectionService (plan §5 rows 12–13, decisions 38–40)', () => {
  it('needs nothing when the lot and godown are the bill line\'s', async () => {
    const { tx, svc, posting } = harness();
    expect(await svc.post(tx as never, doc, [ln()], 'u', { undo: false })).toEqual([]);
    expect(posting.post).not.toHaveBeenCalled();
  });

  it('a different lot → ONE re-lot pair in the bill\'s godown (OUT given lot C, IN bill lot A), no transfer', async () => {
    const { tx, svc, posting, headers, lines } = harness();
    const out = await svc.post(tx as never, doc, [ln({ givenLotId: LOT_C })], 'u', { undo: false });
    expect(out).toEqual([{ kind: 'LOT_SWAP', svhId: 'svh-1', svhRefno: 'DN/2026-2027/D3/00042/C1', lineNos: [1] }]);
    expect(headers).toEqual([{ type: 'ADJUSTMENT', refno: 'DN/2026-2027/D3/00042/C1', from: G1, to: null, reason: null }]);
    expect(shadowLines(lines)).toEqual([
      { godown: G1, lot: LOT_C, qty: '5', reason: 'r-out', direction: -1 },
      { godown: G1, lot: LOT_A, qty: '5', reason: 'r-in', direction: 1 },
    ]);
    expect(posting.post.mock.calls[0][1].rules).toBe(DN_RELOT_RULES);
    expect(posting.post.mock.calls[0][2].ledgerSource).toMatchObject({ srcModule: 'SALES', srcDocType: 'DELIVERY_NOTE' });
    expect(DN_RELOT_RULES.blockNegative).toBe(false);
  });

  it('a different godown → ONE same-branch TRANSFER_OUT giving → bill godown, lot kept, reason DELIVERY_GODOWN', async () => {
    const { tx, svc, posting, headers, lines } = harness();
    const out = await svc.post(tx as never, doc, [ln({ givingGodownId: G2 })], 'u', { undo: false });
    expect(out.map((c) => c.kind)).toEqual(['GODOWN_MOVE']);
    expect(headers).toEqual([{ type: 'TRANSFER_OUT', refno: 'DN/2026-2027/D3/00042/C1', from: G2, to: G1, reason: 'r-gd' }]);
    expect(shadowLines(lines)).toEqual([{ godown: G2, lot: LOT_A, qty: '5', reason: null, direction: null }]);
    expect(posting.post.mock.calls[0][1].rules).toBe(DN_TRANSFER_RULES);
    expect(DN_TRANSFER_RULES.allowsLoading).toBe(false);
  });

  it('both different (decision 39) → transfer C G2 → G1 first, then re-lot C → A in G1', async () => {
    const { tx, svc, headers, lines } = harness();
    const out = await svc.post(tx as never, doc, [ln({ givingGodownId: G2, givenLotId: LOT_C })], 'u', { undo: false });
    expect(out.map((c) => c.kind)).toEqual(['GODOWN_MOVE', 'LOT_SWAP']);
    expect(headers.map((h) => [h.type, h.from, h.to])).toEqual([
      ['TRANSFER_OUT', G2, G1],
      ['ADJUSTMENT', G1, null],
    ]);
    expect(shadowLines(lines)).toEqual([
      { godown: G2, lot: LOT_C, qty: '5', reason: null, direction: null },
      { godown: G1, lot: LOT_C, qty: '5', reason: 'r-out', direction: -1 },
      { godown: G1, lot: LOT_A, qty: '5', reason: 'r-in', direction: 1 },
    ]);
  });

  it('goods back (undo, decision 40) mirrors it: re-lot A → C first, then move C G1 → G2', async () => {
    const { tx, svc, headers, lines } = harness();
    const out = await svc.post(tx as never, doc, [ln({ givingGodownId: G2, givenLotId: LOT_C, qty: D(2) })], 'u', {
      undo: true,
    });
    expect(out.map((c) => [c.kind, c.undo])).toEqual([
      ['LOT_SWAP', true],
      ['GODOWN_MOVE', true],
    ]);
    expect(headers.map((h) => [h.type, h.from, h.to])).toEqual([
      ['ADJUSTMENT', G1, null],
      ['TRANSFER_OUT', G1, G2],
    ]);
    expect(shadowLines(lines)).toEqual([
      { godown: G1, lot: LOT_A, qty: '2', reason: 'r-out', direction: -1 },
      { godown: G1, lot: LOT_C, qty: '2', reason: 'r-in', direction: 1 },
      { godown: G1, lot: LOT_C, qty: '2', reason: null, direction: null },
    ]);
  });

  it('one transfer per (from → to) pair; zero-qty lines are skipped', async () => {
    const { tx, svc, headers } = harness();
    await svc.post(
      tx as never,
      doc,
      [
        ln({ givingGodownId: G2 }),
        ln({ lineNo: 2, givingGodownId: G2 }),
        ln({ lineNo: 3, givingGodownId: G2, qty: D(0) }),
      ],
      'u',
      { undo: false },
    );
    expect(headers).toHaveLength(1);
  });

  it('an engine refusal comes back in the note\'s words (DN_STOCK_NEGATIVE / DN_GODOWN_FROZEN)', async () => {
    const { tx, svc, posting } = harness();
    posting.post.mockRejectedValueOnce(
      new ConflictException({ errors: [{ code: 'STOCK_NEGATIVE_BLOCKED', message: 'would go below 0' }] }),
    );
    await expect(svc.post(tx as never, doc, [ln({ givingGodownId: G2 })], 'u', { undo: false })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'DN_STOCK_NEGATIVE' })] },
    });
    posting.post.mockRejectedValueOnce(
      new ConflictException({ errors: [{ code: 'STOCK_GODOWN_FROZEN', message: 'frozen' }] }),
    );
    await expect(svc.post(tx as never, doc, [ln({ givingGodownId: G2 })], 'u', { undo: false })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'DN_GODOWN_FROZEN' })] },
    });
  });

  it('cancelAll cancels every live shadow of the note, newest first, with its own rules', async () => {
    const { svc, posting } = harness();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        { svh_id: 's2', svh_acc_year: '2026-2027', svh_voucher_type: 'ADJUSTMENT' },
        { svh_id: 's1', svh_acc_year: '2026-2027', svh_voucher_type: 'TRANSFER_OUT' },
      ]),
    };
    expect(await svc.cancelAll(tx as never, { sdnId: 'n', companyId: 'co', branchId: 'br' }, 'u', 'why', new Date())).toBe(4);
    expect(posting.cancel.mock.calls.map((c) => [c[1].svhId, c[1].rules])).toEqual([
      ['s2', DN_RELOT_RULES],
      ['s1', DN_TRANSFER_RULES],
    ]);
  });
});
