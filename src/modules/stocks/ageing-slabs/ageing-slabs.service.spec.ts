import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { AgeingSlabsService, ladderErrors } from './ageing-slabs.service';
import type { AgeingSlabDto } from './dto/ageing-slabs.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';

const DEFAULT: AgeingSlabDto[] = [
  { slabNo: 1, label: '0-30 days', fromDays: 0, toDays: 30 },
  { slabNo: 2, label: '31-60 days', fromDays: 31, toDays: 60 },
  { slabNo: 3, label: 'Over 60 days', fromDays: 61, toDays: null },
];

const codes = (slabs: AgeingSlabDto[]) => ladderErrors(slabs).map((e) => [e.field, e.code]);

describe('ladderErrors (notes 159 §3)', () => {
  it('passes a contiguous ladder from 0 with one open end, last', () => {
    expect(ladderErrors(DEFAULT)).toEqual([]);
  });

  it('passes a single open-ended slab', () => {
    expect(ladderErrors([{ slabNo: 1, label: 'All', fromDays: 0, toDays: null }])).toEqual([]);
  });

  it('wants 1 to 20 slabs', () => {
    expect(codes([])).toEqual([['slabs', 'STOCK_AGEING_SLAB_COUNT']]);
    const many = Array.from({ length: 21 }, (_, i) => ({
      slabNo: i + 1,
      label: `S${i + 1}`,
      fromDays: i,
      toDays: i === 20 ? null : i,
    }));
    expect(codes(many)).toEqual([['slabs', 'STOCK_AGEING_SLAB_COUNT']]);
    expect(ladderErrors(many.slice(0, 20).map((s, i) => (i === 19 ? { ...s, toDays: null } : s)))).toEqual([]);
  });

  it('wants the first slab to start at day 0', () => {
    expect(codes([{ ...DEFAULT[0], fromDays: 1 }, ...DEFAULT.slice(1)])).toEqual([
      ['slabs.0.fromDays', 'STOCK_AGEING_SLAB_FIRST_NOT_ZERO'],
    ]);
  });

  it('names a gap and an overlap on the later slab', () => {
    const gap = [DEFAULT[0], { ...DEFAULT[1], fromDays: 41 }, DEFAULT[2]];
    const [detail] = ladderErrors(gap);
    expect([detail.field, detail.code]).toEqual(['slabs.1.fromDays', 'STOCK_AGEING_SLAB_NOT_CONTIGUOUS']);
    expect(detail.message).toMatch(/days 31–40 in no slab/);

    const overlap = [DEFAULT[0], { ...DEFAULT[1], fromDays: 25 }, DEFAULT[2]];
    expect(ladderErrors(overlap)[0].message).toMatch(/inside slab 1/);
  });

  it('wants exactly one open end, on the last slab', () => {
    expect(codes([DEFAULT[0], DEFAULT[1], { ...DEFAULT[2], toDays: 999 }])).toEqual([
      ['slabs.2.toDays', 'STOCK_AGEING_SLAB_OPEN_END'],
    ]);
    expect(codes([{ ...DEFAULT[0], toDays: null }, DEFAULT[1], DEFAULT[2]])).toEqual([
      ['slabs.0.toDays', 'STOCK_AGEING_SLAB_OPEN_END'],
    ]);
  });

  it('treats a toDays left out as open-ended', () => {
    expect(ladderErrors([DEFAULT[0], DEFAULT[1], { slabNo: 3, label: 'Older', fromDays: 61 }])).toEqual([]);
  });

  it('refuses a slab that ends before it starts', () => {
    expect(codes([DEFAULT[0], { ...DEFAULT[1], toDays: 20 }, { ...DEFAULT[2], fromDays: 21 }])).toEqual([
      ['slabs.1.toDays', 'STOCK_AGEING_SLAB_TO_BEFORE_FROM'],
    ]);
  });

  it('wants slabNo 1..n in order', () => {
    expect(codes([DEFAULT[0], { ...DEFAULT[1], slabNo: 3 }, { ...DEFAULT[2], slabNo: 2 }])).toEqual([
      ['slabs.1.slabNo', 'STOCK_AGEING_SLAB_NUMBER'],
      ['slabs.2.slabNo', 'STOCK_AGEING_SLAB_NUMBER'],
    ]);
  });

  it('wants labels non-blank and unique in any case', () => {
    expect(codes([{ ...DEFAULT[0], label: '  ' }, { ...DEFAULT[1], label: 'old' }, { ...DEFAULT[2], label: 'OLD' }])).toEqual([
      ['slabs.0.label', 'STOCK_AGEING_SLAB_LABEL'],
      ['slabs.2.label', 'STOCK_AGEING_SLAB_LABEL'],
    ]);
  });
});

describe('AgeingSlabsService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock; stockAgeingSlab: { createMany: jest.Mock } };
  let service: AgeingSlabsService;
  let rows: Array<{ own: boolean; sag_slab_no: number; sag_label: string; sag_from_days: number; sag_to_days: number | null }>;

  beforeEach(() => {
    rows = [];
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      stockAgeingSlab: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    prisma = {
      $queryRaw: jest.fn(() => Promise.resolve(rows)),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    service = new AgeingSlabsService(
      prisma as unknown as PrismaService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  it('reads the shared default when the company has none', async () => {
    rows = [{ own: false, sag_slab_no: 1, sag_label: 'All', sag_from_days: 0, sag_to_days: null }];
    await expect(service.get(COMPANY_ID)).resolves.toEqual({
      usingOwn: false,
      slabs: [{ slabNo: 1, label: 'All', fromDays: 0, toDays: null }],
    });
  });

  it("reads the company's own ladder", async () => {
    rows = [{ own: true, sag_slab_no: 1, sag_label: 'Any', sag_from_days: 0, sag_to_days: null }];
    expect((await service.get(COMPANY_ID)).usingOwn).toBe(true);
  });

  it('refuses a bad ladder 422 before opening a transaction', async () => {
    const error = (await service
      .save({ companyId: COMPANY_ID, slabs: [{ ...DEFAULT[0], fromDays: 5 }] })
      .catch((e: unknown) => e)) as { getStatus: () => number; getResponse: () => { errors: Array<{ field: string }> } };
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse().errors.map((e) => e.field)).toEqual(['slabs.0.fromDays', 'slabs.0.toDays']);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('locks, defers ex_sag_overlap, retires the old rows and writes the new ones in one transaction', async () => {
    await service.save({
      companyId: COMPANY_ID,
      slabs: DEFAULT.map((s) => ({ ...s, label: ` ${s.label} ` })),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toMatch(/pg_advisory_xact_lock/);
    const statements = tx.$executeRaw.mock.calls.map((c: [TemplateStringsArray]) => c[0].join('?'));
    expect(statements[0]).toMatch(/SET CONSTRAINTS stock\.ex_sag_overlap DEFERRED/);
    expect(statements[1]).toMatch(/SET sag_is_deleted = true/);
    expect(tx.stockAgeingSlab.createMany).toHaveBeenCalledWith({
      data: DEFAULT.map((s) =>
        expect.objectContaining({
          sagCompanyId: COMPANY_ID,
          sagSlabNo: s.slabNo,
          sagLabel: s.label,
          sagFromDays: s.fromDays,
          sagToDays: s.toDays,
          sagCreatedBy: USER_ID,
        }),
      ),
    });
    // ...and answers with the ladder as now read.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reverts by retiring the company rows, then reads the default', async () => {
    rows = [{ own: false, sag_slab_no: 1, sag_label: 'All', sag_from_days: 0, sag_to_days: null }];
    const ladder = await service.revert(COMPANY_ID);
    expect(prisma.$executeRaw.mock.calls[0][0].join('?')).toMatch(/SET sag_is_deleted = true/);
    expect(prisma.$executeRaw.mock.calls[0]).toContain(COMPANY_ID);
    expect(ladder.usingOwn).toBe(false);
  });
});
