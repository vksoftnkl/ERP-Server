import { DeliveryNoteService, accYearOf, istToday, parseQty } from './delivery-note.service';

jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual('../posting/sales.guards'),
  assertAccYearWritable: jest.fn().mockResolvedValue(undefined),
}));
import { assertAccYearWritable } from '../posting/sales.guards';
import { Prisma } from '@prisma/client';

jest.mock('src/common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual('src/common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn().mockResolvedValue(undefined),
}));

const ALL = { view: true, create: true, edit: true, delete: true, print: true, export: true, post: true, cancel: true, amend: true, override: true, retender: false };
const NOTE = {
  sdnId: '01a1e000-0000-7000-8000-0000000000d1',
  sdnAccYear: '2025-2026',
  sdnCompanyId: 'co',
  sdnBranchId: 'br',
  sdnTenantId: null,
  sdnRefno: 'DN/2025-2026/D3/00007',
  sdnStatus: 'POSTED',
  sdnGodownId: 'g1',
  sdnDeviceId: 'dev',
  sdnCancelledOn: null,
};

function harness(opts: { status?: string; seen?: number; rights?: Partial<typeof ALL> } = {}) {
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('FOR UPDATE')) return [{ sdn_id: NOTE.sdnId, sdn_acc_year: NOTE.sdnAccYear }];
      if (sql.includes('WHERE sde_id = ANY')) return [{ n: opts.seen ?? 0 }];
      return [];
    }),
    saleDeliveryNote: { findUnique: jest.fn().mockResolvedValue({ ...NOTE, sdnStatus: opts.status ?? 'POSTED' }) },
    saleDeliveryNoteItem: { findMany: jest.fn().mockResolvedValue([]) },
    saleDeliveryEvent: { createMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
  const salesContext = { actor: () => 'u', rights: jest.fn().mockResolvedValue({ ...ALL, ...(opts.rights ?? {}) }) };
  const reader = { payload: jest.fn().mockResolvedValue({ note: { sdnId: NOTE.sdnId } }), header: jest.fn() };
  const svc = new DeliveryNoteService(
    prisma as never,
    salesContext as never,
    { linesByKeys: jest.fn().mockResolvedValue([]) } as never,
    { recompute: jest.fn().mockResolvedValue([]) } as never,
    { post: jest.fn().mockResolvedValue([]) } as never,
    reader as never,
    {} as never,
    { logDocumentRevision: jest.fn() } as never,
  );
  return { svc, tx, reader };
}

const GB = (lines: { sdniId: string; qty: string; sdeId?: string }[], reason = 'refused at the door') => ({
  companyId: 'co',
  branchId: 'br',
  accYear: '2025-2026',
  sdnId: NOTE.sdnId,
  reason,
  lines,
});

describe('goods back (addendum §5.1, decisions 57, 69–71)', () => {
  beforeEach(() => (assertAccYearWritable as jest.Mock).mockClear());

  it('a re-sent request whose sdeId exists returns the note and writes nothing (decision 69)', async () => {
    const h = harness({ seen: 1 });
    const out = await h.svc.goodsBack(GB([{ sdniId: 'l1', qty: '1', sdeId: '01a1e000-0000-7000-8000-0000000000e1' }]));
    expect(out).toMatchObject({ replayed: true, postedBills: [], corrections: [] });
    expect(h.tx.saleDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it("the year check is TODAY's year, not the note's (decision 71)", async () => {
    const h = harness({ seen: 1 });
    await h.svc.goodsBack(GB([{ sdniId: 'l1', qty: '1', sdeId: '01a1e000-0000-7000-8000-0000000000e1' }]));
    expect((assertAccYearWritable as jest.Mock).mock.calls[0][2]).toBe(accYearOf(istToday()));
  });

  it.each([
    ['a draft', { status: 'DRAFT' }, 'DN_GOODS_BACK_NOT_POSTED'],
    ['a cancelled note', { status: 'CANCELLED' }, 'DN_ALREADY_CANCELLED'],
    ['no POST right', { rights: { post: false } }, 'DN_RIGHT_POST'],
  ] as const)('%s → %s', async (_n, opts, code) => {
    const h = harness(opts);
    await expect(h.svc.goodsBack(GB([{ sdniId: 'l1', qty: '1' }]))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code })] },
    });
  });

  it('a blank reason → DN_GOODS_BACK_REASON_REQUIRED; more than given → DN_GOODS_BACK_OVER', async () => {
    await expect(harness().svc.goodsBack(GB([{ sdniId: 'l1', qty: '1' }], ' '))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'DN_GOODS_BACK_REASON_REQUIRED' })] },
    });
    await expect(harness().svc.goodsBack(GB([{ sdniId: 'l1', qty: '1' }]))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'DN_GOODS_BACK_OVER', params: expect.objectContaining({ max: '0' }) })] },
    });
  });
});

describe('helpers', () => {
  it('accYearOf: April starts the year', () => {
    expect(accYearOf('2026-11-15')).toBe('2026-2027');
    expect(accYearOf('2027-03-31')).toBe('2026-2027');
    expect(accYearOf('2027-04-01')).toBe('2027-2028');
  });
  it('istToday reads the IST calendar day', () => {
    expect(istToday(new Date('2026-11-14T19:00:00Z'))).toBe('2026-11-15');
  });
  it('parseQty keeps 3 decimals exactly and refuses junk', () => {
    expect(parseQty('12.345')!.toString()).toBe('12.345');
    expect(parseQty(0.1)!.toString()).toBe('0.1');
    expect(parseQty('-2')!.toString()).toBe('-2');
    expect(parseQty('1.2345')).toBeNull();
    expect(parseQty('abc')).toBeNull();
    expect(parseQty(null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  P6 review round (2026-11-16): S2, S3, N3, N4, N6
// ═══════════════════════════════════════════════════════════════════════════

const Dx = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const YEAR_NOW = accYearOf(istToday());
const LAST_YEAR = `${Number(YEAR_NOW.slice(0, 4)) - 1}-${Number(YEAR_NOW.slice(0, 4))}`;

const item = (over: Record<string, unknown> = {}) => ({
  sdniId: 'l1',
  sdniLineNo: 1,
  sdniNoteId: NOTE.sdnId,
  sdniAccYear: YEAR_NOW,
  sdniBillId: 'b1',
  sdniBillAccYear: YEAR_NOW,
  sdniBillItemId: 'bi1',
  sdniBillLineNo: 3,
  sdniItemId: 'it',
  sdniItemUnitId: 'u',
  sdniToBaseFactor: Dx(1),
  sdniGodownId: 'g1',
  sdniBillGodownId: 'g1',
  sdniLotId: null,
  sdniBillLotId: null,
  sdniBucket: 'SALEABLE',
  sdniQty: Dx(10),
  sdniBaseQty: Dx(10),
  ...over,
});

interface RigOpts {
  status?: string;
  noteYear?: string;
  noteBranch?: string;
  /** count(*) of sdn_id anywhere (findForWrite's "is this id used"). */
  used?: number;
  frozen?: boolean;
  /** what is still out on the note line (given less goods back). */
  out?: number;
  /** Σ out of the bill line now (every note). */
  given?: number;
  /** taken part of the line's live posted sale returns (base). */
  taken?: number;
  seen?: number;
  items?: Record<string, unknown>[];
}

function rig(opts: RigOpts = {}) {
  const note = {
    ...NOTE,
    sdnAccYear: opts.noteYear ?? YEAR_NOW,
    sdnStatus: opts.status ?? 'POSTED',
    sdnBranchId: opts.noteBranch ?? 'br',
    sdnRevisionNo: 1,
  };
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('FROM sales.sale_delivery_note') && sql.includes('FOR UPDATE')) {
        const branch = values[2] as string | null;
        return branch && branch !== note.sdnBranchId ? [] : [{ sdn_id: note.sdnId, sdn_acc_year: note.sdnAccYear }];
      }
      if (sql.includes('count(*)::int AS n FROM sales.sale_delivery_note')) return [{ n: opts.used ?? 0 }];
      if (sql.includes('WHERE sde_id = ANY')) return [{ n: opts.seen ?? 0 }];
      if (sql.includes('svh_freeze_from')) {
        return opts.frozen
          ? [{ svh_freeze_from: new Date('2026-11-16T03:30:00Z'), svh_freeze_to: new Date('2026-11-16T12:30:00Z') }]
          : [];
      }
      if (sql.includes('GROUP BY sde_src_line_id')) return [{ line_id: 'l1', q: Dx(opts.out ?? 10) }, { line_id: 'l2', q: Dx(opts.out ?? 10) }];
      if (sql.includes("g.sde_kind = 'GIVEN'")) {
        return [
          {
            sde_id: 'e1',
            sde_src_line_id: 'l1',
            sde_bill_id: 'b1',
            sde_bill_acc_year: YEAR_NOW,
            sde_bill_item_id: 'bi1',
            sde_bill_line_no: 3,
            sde_item_id: 'it',
            sde_godown_id: 'g1',
            sde_lot_id: null,
            out_qty: Dx(opts.out ?? 10),
            out_base: Dx(opts.out ?? 10),
          },
        ];
      }
      return [];
    }),
    saleDeliveryNote: { findUnique: jest.fn().mockResolvedValue(note), update: jest.fn().mockResolvedValue(note) },
    saleDeliveryNoteItem: {
      findMany: jest.fn().mockResolvedValue(opts.items ?? [item()]),
      updateMany: jest.fn(),
    },
    saleDeliveryEvent: { createMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
  const salesContext = { actor: () => 'u', rights: jest.fn().mockResolvedValue({ ...ALL }) };
  const pending = {
    linesByKeys: jest.fn().mockResolvedValue([
      { billItemId: 'bi1', billAccYear: YEAR_NOW, billId: 'b1', billRefno: 'bil00042', lineNo: 3, unitId: 'u', factor: Dx(1), givenBase: Dx(opts.given ?? 10) },
    ]),
    returnsTakenByLine: jest.fn().mockResolvedValue(
      opts.taken
        ? new Map([[`bi1|${YEAR_NOW}`, { takenBase: Dx(opts.taken), refnos: ['SR/2026-2027/D3/00012'] }]])
        : new Map(),
    ),
  };
  const reader = {
    payload: jest.fn().mockResolvedValue({ note: { sdnId: NOTE.sdnId }, lines: [] }),
    header: jest.fn(),
    godownName: jest.fn().mockResolvedValue('ZT Godown'),
    names: jest.fn().mockResolvedValue({ items: new Map(), units: new Map([['u', 'Bag']]), godowns: new Map(), lots: new Map() }),
    lotsKnown: jest.fn().mockResolvedValue(new Set()),
    shelvesBase: jest.fn().mockResolvedValue(new Map()),
  };
  const corrections = { post: jest.fn().mockResolvedValue([]), cancelAll: jest.fn() };
  const status = { recompute: jest.fn().mockResolvedValue([]) };
  const svc = new DeliveryNoteService(
    prisma as never,
    salesContext as never,
    pending as never,
    status as never,
    corrections as never,
    reader as never,
    { remove: jest.fn(), write: jest.fn() } as never,
    { logDocumentRevision: jest.fn(), logEntityChange: jest.fn() } as never,
  );
  return { svc, tx, pending, reader, corrections };
}

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    const err = e as { getStatus: () => number; response: { errors: Record<string, unknown>[] } };
    return { status: err.getStatus(), error: err.response.errors[0] };
  }
  throw new Error('expected a refusal');
};

const body = (over: Record<string, unknown> = {}) => ({
  companyId: 'co',
  branchId: 'br',
  accYear: YEAR_NOW,
  deviceId: 'dev',
  sdnGodownId: 'g1',
  sdnMode: 'SELF',
  sdnCollectedBy: 'Ravi',
  lines: [{ billId: 'b1', billAccYear: YEAR_NOW, billItemId: 'bi1', qty: '1' }],
  ...over,
});

describe('N4 · save / post / validate find the note in the session branch only', () => {
  it.each(['save', 'post', 'validate'] as const)('%s: another branch’s note → 404 DN_NOT_FOUND, nothing written', async (route) => {
    const h = rig({ status: 'DRAFT', noteBranch: 'br-other', used: 1 });
    const out = await codeOf((h.svc[route] as (d: unknown) => Promise<unknown>)(body({ sdnId: NOTE.sdnId })));
    expect(out).toMatchObject({ status: 404, error: { code: 'DN_NOT_FOUND', field: 'sdnId' } });
    const lock = h.tx.$queryRaw.mock.calls.find(([s]) => (s as TemplateStringsArray).join('?').includes('FOR UPDATE'))!;
    expect((lock[0] as TemplateStringsArray).join('?')).toContain('sdn_branch_id');
    expect(lock.slice(1)).toContain('br');
    expect(h.tx.saleDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it('a client uuid never used is a new note (validate answers, no 404)', async () => {
    const h = rig({ used: 0, noteBranch: 'br-other' });
    const out = (await h.svc.validate(body({ sdnId: '01a1e000-0000-7000-8000-0000000000f9' }) as never)) as { errors: { code: string }[] };
    expect(out.errors.map((e) => e.code)).not.toContain('DN_NOT_FOUND');
  });
});

describe('N3 · a note is filed in the year it is posted in', () => {
  beforeEach(() => (assertAccYearWritable as jest.Mock).mockClear());

  it('posting a draft saved last year → 409 DN_DRAFT_YEAR_CHANGED, before any year or write', async () => {
    const h = rig({ status: 'DRAFT', noteYear: LAST_YEAR });
    const out = await codeOf(h.svc.post(body({ sdnId: NOTE.sdnId, accYear: LAST_YEAR }) as never));
    expect(out).toMatchObject({
      status: 409,
      error: { code: 'DN_DRAFT_YEAR_CHANGED', field: 'sdnId', params: { year: LAST_YEAR, yearNow: YEAR_NOW } },
    });
    expect(assertAccYearWritable).not.toHaveBeenCalled();
    expect(h.tx.saleDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it('a fresh post from a session still in last year → the same code on accYear', async () => {
    const out = await codeOf(rig().svc.post(body({ accYear: LAST_YEAR }) as never));
    expect(out).toMatchObject({ status: 409, error: { code: 'DN_DRAFT_YEAR_CHANGED', field: 'accYear' } });
  });

  it('a NEW draft saved from a session in last year → 409 at /save (field=accYear), nothing written', async () => {
    const h = rig();
    const out = await codeOf(h.svc.save(body({ accYear: LAST_YEAR }) as never));
    expect(out).toMatchObject({ status: 409, error: { code: 'DN_DRAFT_YEAR_CHANGED', field: 'accYear', params: { year: LAST_YEAR, yearNow: YEAR_NOW } } });
    expect(assertAccYearWritable).not.toHaveBeenCalled();
  });

  it('an EXISTING draft from last year may still be re-saved (cleaned up): no year refusal at /save', async () => {
    const h = rig({ status: 'DRAFT', noteYear: LAST_YEAR });
    const err = await h.svc.save(body({ sdnId: NOTE.sdnId, accYear: LAST_YEAR }) as never).then(
      () => null,
      (e: { response?: { errors?: { code: string }[] } }) => e,
    );
    expect(err?.response?.errors?.[0]?.code).not.toBe('DN_DRAFT_YEAR_CHANGED');
    expect((assertAccYearWritable as jest.Mock).mock.calls[0][2]).toBe(LAST_YEAR);
  });

  it('validate lists it first, as an error', async () => {
    const h = rig({ status: 'DRAFT', noteYear: LAST_YEAR });
    const out = (await h.svc.validate(body({ sdnId: NOTE.sdnId }) as never)) as { ok: boolean; errors: { code: string }[] };
    expect(out.ok).toBe(false);
    expect(out.errors[0].code).toBe('DN_DRAFT_YEAR_CHANGED');
  });

  it('a draft of this year is judged writable on today’s year', async () => {
    const h = rig({ status: 'DRAFT' });
    await h.svc.post(body({ sdnId: NOTE.sdnId }) as never).catch(() => undefined);
    expect((assertAccYearWritable as jest.Mock).mock.calls[0]?.[2]).toBe(YEAR_NOW);
  });
});

describe('S2 · one note line once', () => {
  it('save with one sdniId twice → 422 DN_LINE_DUPLICATE before anything is written', async () => {
    const line = { sdniId: '01a1e000-0000-7000-8000-0000000000a1', billId: 'b1', billAccYear: YEAR_NOW, billItemId: 'bi1', qty: '1' };
    const h = rig();
    const out = await codeOf(h.svc.save(body({ lines: [line, { ...line, qty: '2' }] }) as never));
    expect(out).toMatchObject({ status: 422, error: { code: 'DN_LINE_DUPLICATE', field: 'lines[1].sdniId', line: 2 } });
  });

  it('goods back sums rows of one note line before the max: 5 + 5 of 6 → DN_GOODS_BACK_OVER (qty 10)', async () => {
    const out = await codeOf(rig({ out: 6 }).svc.goodsBack(GB([{ sdniId: 'l1', qty: '5' }, { sdniId: 'l1', qty: '5' }])));
    expect(out).toMatchObject({ status: 409, error: { code: 'DN_GOODS_BACK_OVER', params: { qty: '10', max: '6' } } });
  });

  it('goods back of 2 + 3 on one line writes ONE event of 5 under the first sdeId', async () => {
    const h = rig({ out: 6 });
    await h.svc.goodsBack(
      GB([
        { sdniId: 'l1', qty: '2', sdeId: '01a1e000-0000-7000-8000-0000000000e1' },
        { sdniId: 'l1', qty: '3', sdeId: '01a1e000-0000-7000-8000-0000000000e2' },
      ]),
    );
    const data = h.tx.saleDeliveryEvent.createMany.mock.calls[0][0].data as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ sdeId: '01a1e000-0000-7000-8000-0000000000e1', sdeKind: 'GOODS_BACK' });
    expect(String(data[0].sdeSettleQty)).toBe('-5');
  });

  it('one sdeId on two note lines → DN_LINE_DUPLICATE (it is the event’s key)', async () => {
    const h = rig({ items: [item(), item({ sdniId: 'l2', sdniLineNo: 2 })] });
    const sdeId = '01a1e000-0000-7000-8000-0000000000e3';
    const out = await codeOf(h.svc.goodsBack(GB([{ sdniId: 'l1', qty: '1', sdeId }, { sdniId: 'l2', qty: '1', sdeId }])));
    expect(out).toMatchObject({ status: 422, error: { code: 'DN_LINE_DUPLICATE', field: 'lines[1].sdeId' } });
  });
});

describe('S3 / R-1 · never below what sale returns took back', () => {
  it('cancel of a note that gave all 10, after a return took 4 back → 409 DN_UNDO_BELOW_RETURNED, nothing written', async () => {
    const h = rig({ out: 10, given: 10, taken: 4 });
    const out = await codeOf(h.svc.cancel({ ...GB([]), reason: 'wrong note' } as never));
    expect(out).toMatchObject({
      status: 409,
      error: {
        code: 'DN_UNDO_BELOW_RETURNED',
        field: 'sdnId',
        line: 1,
        params: { n: 3, bill: 'bil00042', qty: '4', unit: 'Bag', sr: 'SR/2026-2027/D3/00012' },
      },
    });
    expect(h.tx.saleDeliveryEvent.createMany).not.toHaveBeenCalled();
    expect(h.corrections.cancelAll).not.toHaveBeenCalled();
    // read under the bill lock
    const billLock = h.tx.$queryRaw.mock.calls.findIndex(([s]) => (s as TemplateStringsArray).join('?').includes('FROM sales.sale_bill b'));
    expect(h.tx.$queryRaw.mock.invocationCallOrder[billLock]).toBeLessThan(h.pending.returnsTakenByLine.mock.invocationCallOrder[0]);
  });

  it('goods back down to the taken part passes (6 of 10, 4 taken); 7 is refused', async () => {
    const ok = rig({ out: 10, given: 10, taken: 4 });
    await ok.svc.goodsBack(GB([{ sdniId: 'l1', qty: '6' }]));
    expect(ok.tx.saleDeliveryEvent.createMany).toHaveBeenCalledTimes(1);
    const out = await codeOf(rig({ out: 10, given: 10, taken: 4 }).svc.goodsBack(GB([{ sdniId: 'l1', qty: '7' }])));
    expect(out).toMatchObject({ status: 409, error: { code: 'DN_UNDO_BELOW_RETURNED', field: 'lines[0].qty' } });
  });

  it('no live posted return on the line → the cancel goes ahead', async () => {
    const h = rig({ out: 10, given: 10 });
    await h.svc.cancel({ ...GB([]), reason: 'wrong note' } as never);
    expect(h.tx.saleDeliveryEvent.createMany).toHaveBeenCalledTimes(1);
  });
});

describe('N6 · cancel and goods back meet the count freeze', () => {
  it.each([
    ['goods back', 'GOODS_BACK'],
    ['cancel', 'CANCEL'],
  ] as const)('%s in a frozen godown → 409 DN_GODOWN_FROZEN (event %s), nothing written', async (what, event) => {
    const h = rig({ frozen: true });
    const call =
      what === 'cancel'
        ? h.svc.cancel({ ...GB([]), reason: 'wrong note' } as never)
        : h.svc.goodsBack(GB([{ sdniId: 'l1', qty: '1' }]));
    const out = await codeOf(call);
    expect(out).toMatchObject({
      status: 409,
      error: { code: 'DN_GODOWN_FROZEN', event, field: 'sdnGodownId', params: { godown: 'ZT Godown' } },
    });
    expect(h.tx.saleDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it('a re-sent goods back (its sdeId exists) still replays during a freeze', async () => {
    const out = await rig({ frozen: true, seen: 1 }).svc.goodsBack(
      GB([{ sdniId: 'l1', qty: '1', sdeId: '01a1e000-0000-7000-8000-0000000000e1' }]),
    );
    expect(out).toMatchObject({ replayed: true });
  });
});
