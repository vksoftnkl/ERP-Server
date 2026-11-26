import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  StickerDocAlloc,
  StickerDocLine,
  StickerDocSourceService,
  docState,
  docTotals,
  foldDocCounts,
  neededLabels,
} from './sticker-doc-source.service';
import { StickerLinesService } from './sticker-lines.service';
import { BuiltStickerLine } from './types/sticker.types';

/**
 * Sticker printing S-P2 (plan §4.1 / §4.2 / §4.4 / §7.1-7.3, §7.8): the
 * counts per document + item + lot (the same rule as grid 224), the state, the
 * carry-over of a GRN billed again, the document and line checks at print and
 * "left" re-checked under the per-document lock.
 */

const D = (value: number | string) => new Prisma.Decimal(value);
const COMPANY = 'c0000000-0000-7000-8000-000000000001';
const BRANCH = 'b0000000-0000-7000-8000-000000000001';
const BILL = 'e0000000-0000-7000-8000-000000000001';
const YEAR = '2026-2027';

const line = (over: Partial<StickerDocLine> & { lineId: string; lineNo: number; itemId: string }) =>
  ({
    itemName: over.itemId,
    ticked: true,
    factor: D(1),
    defUnitId: `def-${over.itemId}`,
    defFactor: D(1),
    defDecimals: 0,
    grnLineId: null,
    grnId: null,
    grnYear: null,
    grnRefno: null,
    ...over,
  }) as StickerDocLine;

const alloc = (
  lineId: string,
  lotId: string,
  qty: number | string,
  rowNo = 1,
): StickerDocAlloc => ({
  lineId,
  lotId,
  qty: D(qty),
  rowNo,
});

describe('neededLabels (grid 224: floor(round(base / def, 6)), min 1; decimal unit 1)', () => {
  it('the S5 cases', () => {
    // sugar CASE·10 × 3, Def PCS → 30
    expect(neededLabels(D(3).times(10), D(1), 0)).toBe(30);
    // oil CASE·12, 4 + 1 free → 60
    expect(neededLabels(D(5).times(12), D(1), 0)).toBe(60);
    // Def unit = CASE (factor 12): 60 pieces → 5
    expect(neededLabels(D(60), D(12), 0)).toBe(5);
    // 5 pieces in CASE·12 → 0.41… → floor 0 → at least 1
    expect(neededLabels(D(5), D(12), 0)).toBe(1);
    // dal 50 kg, Def KG with decimals → 1
    expect(neededLabels(D(50), D(1), 3)).toBe(1);
    // nothing in → 0
    expect(neededLabels(D(0), D(1), 0)).toBe(0);
  });

  it('round to 6 places before the floor (0.9999999 → 1, as round(…, 6) does)', () => {
    expect(neededLabels(D('2.9999999'), D(1), 0)).toBe(3);
    expect(neededLabels(D('2.999999'), D(1), 0)).toBe(2);
  });
});

describe('foldDocCounts', () => {
  const lines = [
    line({ lineId: 'L1', lineNo: 1, itemId: 'SUGAR', factor: D(10) }),
    line({ lineId: 'L2', lineNo: 2, itemId: 'OIL', factor: D(12) }),
    line({ lineId: 'L3', lineNo: 3, itemId: 'DAL', defDecimals: 3 }),
    line({ lineId: 'L4', lineNo: 4, itemId: 'SURF', ticked: false }),
    line({ lineId: 'L7', lineNo: 7, itemId: 'SUGAR', factor: D(10) }),
  ];

  it('one entry per item + lot; two lines of one item + lot merge (Q8), lowest line first', () => {
    const entries = foldDocCounts({
      lines,
      // the reader reads SALEABLE rows only: damaged rows never get here
      allocs: [
        alloc('L1', 'lotS', 3),
        alloc('L2', 'lotO', 5),
        alloc('L3', 'lotD', 50),
        alloc('L4', 'lotF', 12),
        alloc('L7', 'lotS', 1),
      ],
      jobs: [],
      carries: [],
    });
    const sugar = entries.find((entry) => entry.itemId === 'SUGAR');
    expect(sugar).toMatchObject({ needed: 40, left: 40, lotId: 'lotS' });
    expect(sugar?.lines.map((entry) => entry.lineNo)).toEqual([1, 7]);
    expect(entries.map((entry) => `${entry.itemId}:${entry.needed}`)).toEqual([
      'SUGAR:40',
      'OIL:60',
      'DAL:1',
      'SURF:12',
    ]);
  });

  it('two lots of one line are two entries', () => {
    const entries = foldDocCounts({
      lines,
      allocs: [alloc('L2', 'lotA', 2, 1), alloc('L2', 'lotB', 3, 2)],
      jobs: [],
      carries: [],
    });
    expect(entries.map((entry) => [entry.lotId, entry.needed])).toEqual([
      ['lotA', 24],
      ['lotB', 36],
    ]);
  });

  it('printed = this document’s PRINT jobs (the reader leaves out FAILED); REPRINT apart', () => {
    const [oil] = foldDocCounts({
      lines,
      allocs: [alloc('L2', 'lotO', 5)],
      jobs: [{ itemId: 'OIL', lotId: 'lotO', printed: 40, reprinted: 3 }],
      carries: [],
    });
    expect(oil).toMatchObject({ needed: 60, printed: 40, reprinted: 3, carried: 0, left: 20 });
  });

  it('carried (Q20) adds up over cancelled bills and is capped so left ≥ 0', () => {
    const [oil] = foldDocCounts({
      lines,
      allocs: [alloc('L2', 'lotO', 5)],
      jobs: [{ itemId: 'OIL', lotId: 'lotO', printed: 20, reprinted: 0 }],
      carries: [
        {
          fromId: 'X1',
          fromYear: YEAR,
          fromRefno: 'PUR/1',
          itemId: 'OIL',
          lotId: 'lotO',
          labels: 30,
        },
        {
          fromId: 'X2',
          fromYear: YEAR,
          fromRefno: 'PUR/2',
          itemId: 'OIL',
          lotId: 'lotO',
          labels: 30,
        },
      ],
    });
    expect(oil).toMatchObject({
      needed: 60,
      printedRaw: 20,
      carriedRaw: 60,
      printed: 20,
      carried: 40,
      left: 0,
    });
  });

  it('printed above needed is shown capped (printed + carried = the grid’s LEAST)', () => {
    const [oil] = foldDocCounts({
      lines,
      allocs: [alloc('L2', 'lotO', 5)],
      jobs: [{ itemId: 'OIL', lotId: 'lotO', printed: 70, reprinted: 0 }],
      carries: [
        { fromId: 'X1', fromYear: YEAR, fromRefno: null, itemId: 'OIL', lotId: 'lotO', labels: 5 },
      ],
    });
    expect(oil).toMatchObject({ printed: 60, carried: 0, left: 0 });
  });
});

describe('docState / docTotals', () => {
  const entry = (needed: number, printedRaw: number, carriedRaw = 0) => {
    const [one] = foldDocCounts({
      lines: [line({ lineId: 'L', lineNo: 1, itemId: 'I' })],
      allocs: [alloc('L', 'lot', needed)],
      jobs: printedRaw ? [{ itemId: 'I', lotId: 'lot', printed: printedRaw, reprinted: 0 }] : [],
      carries: carriedRaw
        ? [
            {
              fromId: 'X',
              fromYear: YEAR,
              fromRefno: null,
              itemId: 'I',
              lotId: 'lot',
              labels: carriedRaw,
            },
          ]
        : [],
    });
    return one;
  };

  it('NONE / NOT / PART / DONE', () => {
    expect(docState([])).toBe('NONE');
    expect(docState([entry(30, 0)])).toBe('NOT');
    expect(docState([entry(30, 10), entry(60, 0)])).toBe('PART');
    expect(docState([entry(30, 30), entry(60, 20, 40)])).toBe('DONE');
    expect(docTotals([entry(30, 10), entry(60, 20, 50)])).toEqual({
      needed: 90,
      printed: 30,
      carried: 40,
      left: 20,
    });
  });
});

// ─── The service, over a fake database ──────────────────────────────────────

interface FakeDoc {
  head?: Record<string, unknown> | null;
  lines?: Array<Record<string, unknown>>;
  allocs?: Array<Record<string, unknown>>;
  jobs?: Array<Record<string, unknown>>;
  carries?: Array<Record<string, unknown>>;
  jobList?: Array<Record<string, unknown>>;
  afterPost?: string | null;
}

const headRow = (over: Record<string, unknown> = {}) => ({
  doc_id: BILL,
  acc_year: YEAR,
  company_id: COMPANY,
  branch_id: BRANCH,
  refno: 'PUR/2026-2027/D8/01177',
  doc_date: '2026-11-26',
  status: 'POSTED',
  is_deleted: false,
  supplier_id: 'sup-1',
  supplier_name: 'Sri Murugan Agencies',
  source_kind: 'DIRECT',
  ...over,
});

const lineRow = (
  lineId: string,
  lineNo: number,
  itemId: string,
  over: Record<string, unknown> = {},
) => ({
  line_id: lineId,
  line_no: lineNo,
  item_id: itemId,
  factor: D(1),
  grn_line_id: null,
  grn_id: null,
  grn_year: null,
  grn_refno: null,
  item_name: `ZT ${itemId}`,
  ticked: true,
  def_unit_id: `def-${itemId}`,
  def_factor: D(1),
  def_decimals: 0,
  ...over,
});

function fakeDb(doc: FakeDoc, seen: string[] = []) {
  return {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      seen.push(sql);
      if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve([{ locked: 1 }]);
      if (
        sql.includes('FROM purchase.pur_invoice p') ||
        sql.includes('FROM purchase.pur_shortage_receipt r')
      ) {
        return Promise.resolve(doc.head === null ? [] : [doc.head ?? headRow()]);
      }
      if (sql.includes('from_bills AS')) return Promise.resolve(doc.carries ?? []);
      if (sql.includes('COALESCE(i.item_barcode_sticker')) return Promise.resolve(doc.lines ?? []);
      if (sql.includes('JOIN purchase.pur_item_alloc a')) return Promise.resolve(doc.allocs ?? []);
      if (sql.includes('AS reprinted')) return Promise.resolve(doc.jobs ?? []);
      if (sql.includes('ORDER BY j.lbj_printed_on')) return Promise.resolve(doc.jobList ?? []);
      if (sql.includes('fn_app_settings_effective')) {
        return Promise.resolve(doc.afterPost === undefined ? [] : [{ value: doc.afterPost }]);
      }
      throw new Error(`unexpected ${sql.slice(0, 100)}`);
    }),
  };
}

function service(doc: FakeDoc, seen: string[] = []) {
  const prisma = fakeDb(doc, seen) as unknown as PrismaService;
  const context = {
    getUserId: () => 'user-1',
    getDeviceId: () => 'dev-8',
  } as unknown as RequestContextService;
  const lines = {
    assertRight: jest.fn(() => Promise.resolve()),
    assertBranchInCompany: jest.fn(() => Promise.resolve()),
    scopeFor: jest.fn(() =>
      Promise.resolve({
        companyId: COMPANY,
        branchId: BRANCH,
        assignment: { purposeCode: 'ITEM_LABEL' },
      }),
    ),
    buildLines: jest.fn(
      (_scope: unknown, inputs: Array<Record<string, unknown>>): Promise<BuiltStickerLine[]> =>
        Promise.resolve(
          inputs.map(
            (input) =>
              ({
                line: {
                  key: input.key,
                  itemId: input.itemId,
                  unitId: input.unitId,
                  lotId: input.lotId,
                  labels: input.labels,
                  itemName: `ZT ${String(input.itemId)}`,
                  problem: null,
                },
                facts: {},
              }) as unknown as BuiltStickerLine,
          ),
        ),
    ),
  } as unknown as StickerLinesService;
  return { svc: new StickerDocSourceService(prisma, context, lines), lines };
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: {
      status?: number;
      response?: { errors?: Array<{ code: string; rule?: string; line?: number }> };
    }) => {
      const first = error.response?.errors?.[0];
      return `${error.status}:${first?.code}${first?.rule ? `/${first.rule}` : ''}${first?.line ? `@${first.line}` : ''}`;
    },
  );

const ref = {
  companyId: COMPANY,
  branchId: BRANCH,
  docType: 'PURCHASE_BILL',
  docId: BILL,
  accYear: YEAR,
};
const fromDocQuery = { ...ref, purposeCode: 'ITEM_LABEL', priceLevel: 2 };

const billDoc = (over: FakeDoc = {}): FakeDoc => ({
  lines: [
    lineRow('L1', 1, 'SUGAR', { factor: D(10) }),
    lineRow('L2', 2, 'OIL', { factor: D(12) }),
    lineRow('L6', 6, 'SURF', { ticked: false }),
    lineRow('L7', 7, 'SUGAR', { factor: D(10) }),
  ],
  allocs: [
    { line_id: 'L1', lot_id: 'lotS', qty: D(3), row_no: 1 },
    { line_id: 'L2', lot_id: 'lotO', qty: D(5), row_no: 1 },
    { line_id: 'L6', lot_id: 'lotF', qty: D(12), row_no: 1 },
    { line_id: 'L7', lot_id: 'lotS', qty: D(1), row_no: 1 },
  ],
  ...over,
});

describe('StickerDocSourceService.fromDoc (§7.1)', () => {
  it('lines per item + lot, Def unit, the row’s lot, labels = left, source keys; unticked skipped', async () => {
    const { svc, lines } = service(
      billDoc({ jobs: [{ item_id: 'OIL', lot_id: 'lotO', printed: 40, reprinted: 2 }] }),
    );
    const answer = await svc.fromDoc(fromDocQuery);
    expect(answer.doc).toMatchObject({
      docType: 'PURCHASE_BILL',
      refno: 'PUR/2026-2027/D8/01177',
      docDate: '26/11/2026',
      sourceKind: 'DIRECT',
      fromGrns: [],
      linesAll: 4,
      linesTicked: 3,
    });
    expect(
      answer.lines.map((entry) => [entry.key, entry.unitId, entry.lotId, entry.labels]),
    ).toEqual([
      ['D:L1:lotS', 'def-SUGAR', 'lotS', 40],
      ['D:L2:lotO', 'def-OIL', 'lotO', 20],
    ]);
    expect(answer.lines[0]).toMatchObject({
      srcDocType: 'PURCHASE_BILL',
      srcDocId: BILL,
      srcAccYear: YEAR,
      srcRefno: 'PUR/2026-2027/D8/01177',
      srcLineId: 'L1',
      srcLineNo: 1,
      srcLineNos: [1, 7],
      srcGrnRefno: null,
      needed: 40,
      printed: 0,
      carried: 0,
      left: 40,
    });
    expect(answer.lines[1]).toMatchObject({ needed: 60, printed: 40, left: 20, reprinted: 2 });
    expect(answer.skipped.notTicked).toEqual([{ lineNo: 6, itemName: 'ZT SURF' }]);
    // the builder gets a good labels value even when left is 0
    const built = (lines.buildLines as jest.Mock).mock.calls[0][1] as Array<{ labels: number }>;
    expect(built.map((input) => input.labels)).toEqual([40, 20]);
  });

  it('stickerOnly=false loads the unticked lines too', async () => {
    const answer = await service(billDoc()).svc.fromDoc({ ...fromDocQuery, stickerOnly: false });
    expect(answer.lines.map((entry) => entry.itemId)).toEqual(['SUGAR', 'OIL', 'SURF']);
    expect(answer.skipped.notTicked).toEqual([]);
  });

  it('a fully printed document still loads, labels 0 (C9)', async () => {
    const answer = await service(
      billDoc({
        jobs: [
          { item_id: 'SUGAR', lot_id: 'lotS', printed: 40, reprinted: 0 },
          { item_id: 'OIL', lot_id: 'lotO', printed: 60, reprinted: 0 },
        ],
      }),
    ).svc.fromDoc(fromDocQuery);
    expect(answer.lines.map((entry) => entry.labels)).toEqual([0, 0]);
  });

  it('a bill made from a GRN: fromGrns, srcGrnRefno', async () => {
    const answer = await service(
      billDoc({
        head: headRow({ source_kind: 'GRN' }),
        lines: [
          lineRow('L1', 1, 'OIL', {
            factor: D(12),
            grn_line_id: 'G-L1',
            grn_id: 'G1',
            grn_year: YEAR,
            grn_refno: 'GRN/2026-2027/D8/00041',
          }),
        ],
        allocs: [{ line_id: 'L1', lot_id: 'lotO', qty: D(2), row_no: 1 }],
      }),
    ).svc.fromDoc(fromDocQuery);
    expect(answer.doc.fromGrns).toEqual([
      { grnId: 'G1', accYear: YEAR, refno: 'GRN/2026-2027/D8/00041' },
    ]);
    expect(answer.lines[0]).toMatchObject({ srcGrnRefno: 'GRN/2026-2027/D8/00041', needed: 24 });
  });

  it('refusals: type, not found (other company, deleted), other branch, not posted, nothing ticked', async () => {
    expect(await codeOf(service(billDoc()).svc.fromDoc({ ...fromDocQuery, docType: 'GRN' }))).toBe(
      '422:STICKER_DOC_TYPE_INVALID',
    );
    expect(await codeOf(service(billDoc({ head: null })).svc.fromDoc(fromDocQuery))).toBe(
      '404:STICKER_DOC_NOT_FOUND',
    );
    expect(
      await codeOf(
        service(billDoc({ head: headRow({ company_id: 'other' }) })).svc.fromDoc(fromDocQuery),
      ),
    ).toBe('404:STICKER_DOC_NOT_FOUND');
    expect(
      await codeOf(
        service(billDoc({ head: headRow({ is_deleted: true }) })).svc.fromDoc(fromDocQuery),
      ),
    ).toBe('404:STICKER_DOC_NOT_FOUND');
    expect(
      await codeOf(
        service(billDoc({ head: headRow({ branch_id: 'other-branch' }) })).svc.fromDoc(
          fromDocQuery,
        ),
      ),
    ).toBe('422:STICKER_DOC_OTHER_BRANCH');
    expect(
      await codeOf(
        service(billDoc({ head: headRow({ status: 'CANCELLED' }) })).svc.fromDoc(fromDocQuery),
      ),
    ).toBe('422:STICKER_DOC_NOT_POSTED');
    expect(
      await codeOf(
        service(billDoc({ lines: [lineRow('L6', 6, 'SURF', { ticked: false })] })).svc.fromDoc(
          fromDocQuery,
        ),
      ),
    ).toBe('422:STICKER_DOC_NOTHING_TICKED');
  });

  it('the refusal carries the wording’s params', async () => {
    await expect(
      service(billDoc({ head: headRow({ status: 'CANCELLED' }) })).svc.fromDoc(fromDocQuery),
    ).rejects.toMatchObject({
      response: {
        errors: [
          expect.objectContaining({
            code: 'STICKER_DOC_NOT_POSTED',
            params: { doc: 'PUR/2026-2027/D8/01177', status: 'cancelled' },
          }),
        ],
      },
    });
  });
});

describe('StickerDocSourceService.state (§7.2)', () => {
  it('ticked items only; state, jobs, carriedFrom, afterPost of this counter', async () => {
    const answer = await service(
      billDoc({
        jobs: [{ item_id: 'OIL', lot_id: 'lotO', printed: 40, reprinted: 0 }],
        jobList: [
          {
            lbj_id: 'J1',
            lbj_refno: 'D8-000300',
            lbj_acc_year: YEAR,
            lbj_label_count: 40,
            lbj_kind: 'PRINT',
            lbj_status: 'PRINTED',
            lbj_printed_on: new Date('2026-11-26T05:00:00Z'),
            reprint: false,
          },
        ],
        afterPost: 'NEVER',
      }),
    ).svc.state(ref);
    expect(answer).toMatchObject({
      linesAll: 4,
      linesTicked: 3,
      needed: 100,
      printed: 40,
      carried: 0,
      left: 60,
      state: 'PART',
      afterPost: 'NEVER',
      carriedFrom: [],
    });
    expect(answer.jobs).toEqual([
      {
        jobId: 'J1',
        jobNo: 'D8-000300',
        accYear: YEAR,
        labels: 40,
        kind: 'PRINT',
        reprint: false,
        status: 'PRINTED',
        printedOn: '26/11/2026 10:30 AM',
      },
    ]);
  });

  it('nothing ticked → NONE; afterPost defaults to ASK; any status answers (C14)', async () => {
    const answer = await service(
      billDoc({
        head: headRow({ status: 'CANCELLED' }),
        lines: [lineRow('L6', 6, 'SURF', { ticked: false })],
        allocs: [{ line_id: 'L6', lot_id: 'lotF', qty: D(12), row_no: 1 }],
      }),
    ).svc.state(ref);
    expect(answer).toMatchObject({
      state: 'NONE',
      needed: 0,
      afterPost: 'ASK',
      status: 'CANCELLED',
    });
  });

  it('carry-over: a GRN billed again after its bill was cancelled', async () => {
    const grnLine = { grn_line_id: 'G-L1', grn_id: 'G1', grn_year: YEAR, grn_refno: 'GRN/1' };
    const answer = await service({
      head: headRow({ source_kind: 'GRN' }),
      lines: [lineRow('L1', 1, 'OIL', { factor: D(12), ...grnLine })],
      allocs: [{ line_id: 'L1', lot_id: 'lotO', qty: D(5), row_no: 1 }],
      carries: [
        {
          from_id: 'X1',
          from_year: YEAR,
          from_refno: 'PUR/X1',
          item_id: 'OIL',
          lot_id: 'lotO',
          labels: 30,
        },
      ],
    }).svc.state(ref);
    expect(answer).toMatchObject({
      needed: 60,
      printed: 0,
      carried: 30,
      left: 30,
      state: 'PART',
      carriedFrom: [{ docId: 'X1', accYear: YEAR, refno: 'PUR/X1', labels: 30 }],
      fromGrns: [{ grnId: 'G1', accYear: YEAR, refno: 'GRN/1' }],
    });
  });

  it('a shortage receipt reads its own head and rows (no carry-over query)', async () => {
    const seen: string[] = [];
    const answer = await service(
      {
        head: headRow({ source_kind: null, refno: 'SHR/2026-2027/D8/00007' }),
        lines: [lineRow('R1', 1, 'TEA')],
        allocs: [{ line_id: 'R1', lot_id: 'lotT', qty: D(4), row_no: 1 }],
      },
      seen,
    ).svc.state({ ...ref, docType: 'SHORTAGE_RECEIPT' });
    expect(answer).toMatchObject({
      docType: 'SHORTAGE_RECEIPT',
      sourceKind: null,
      needed: 4,
      state: 'NOT',
    });
    expect(seen.some((sql) => sql.includes('FROM purchase.pur_shortage_receipt r'))).toBe(true);
    expect(seen.some((sql) => sql.includes('from_bills AS'))).toBe(false);
  });
});

describe('StickerDocSourceService.prepareDocJob (§7.3)', () => {
  // No itemName: the words take the document line's (ZT OIL).
  const printLine = (over: Record<string, unknown> = {}) => ({
    itemId: 'OIL',
    unitId: 'def-OIL',
    lotId: 'lotO',
    labels: 20,
    srcLineId: 'L2',
    ...over,
  });
  const prepare = (doc: FakeDoc, lines: Array<Record<string, unknown>>, source = {}) =>
    service(doc).svc.prepareDocJob({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR, ...source },
      lines: lines as never,
    });

  it('the source checks: type, found, branch, posted', async () => {
    expect(await codeOf(prepare(billDoc(), [printLine()], { docType: 'GRN' }))).toBe(
      '422:STICKER_DOC_TYPE_INVALID',
    );
    expect(await codeOf(prepare(billDoc({ head: null }), [printLine()]))).toBe(
      '404:STICKER_DOC_NOT_FOUND',
    );
    expect(
      await codeOf(prepare(billDoc({ head: headRow({ branch_id: 'x' }) }), [printLine()])),
    ).toBe('422:STICKER_DOC_OTHER_BRANCH');
    expect(
      await codeOf(prepare(billDoc({ head: headRow({ status: 'DRAFT' }) }), [printLine()])),
    ).toBe('422:STICKER_DOC_NOT_POSTED');
  });

  it('the line checks (C6, C2): no srcLineId, a foreign line, another item, a lot not on it, not the Def unit', async () => {
    const doc = billDoc();
    expect(await codeOf(prepare(doc, [printLine(), printLine({ srcLineId: undefined })]))).toBe(
      '422:STICKER_DOC_LINE_NOT_ON_DOC@2',
    );
    expect(await codeOf(prepare(doc, [printLine({ srcLineId: 'L-foreign' })]))).toBe(
      '422:STICKER_DOC_LINE_NOT_ON_DOC@1',
    );
    expect(await codeOf(prepare(doc, [printLine({ srcLineId: 'L1' })]))).toBe(
      '422:STICKER_DOC_LINE_NOT_ON_DOC@1',
    );
    expect(await codeOf(prepare(doc, [printLine({ lotId: 'lotS' })]))).toBe(
      '422:STICKER_DOC_LINE_NOT_ON_DOC@1',
    );
    expect(await codeOf(prepare(doc, [printLine({ lotId: undefined })]))).toBe(
      '422:STICKER_DOC_LINE_NOT_ON_DOC@1',
    );
    expect(await codeOf(prepare(doc, [printLine({ unitId: 'box-OIL' })]))).toBe(
      '422:STICKER_DOC_LINE_NOT_ON_DOC/UNIT@1',
    );
  });

  it('a manual job naming a document line is refused (C6)', () => {
    const { svc } = service({});
    expect(() => svc.refuseManualDocLines([{}, { srcLineId: 'L2' }])).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errors: [expect.objectContaining({ code: 'STICKER_DOC_LINE_NOT_ON_DOC', line: 2 })],
        }),
      }),
    );
    expect(() => svc.refuseManualDocLines([{}, { srcLineId: null }])).not.toThrow();
  });

  it('the guard locks the document, then counts again: the second of two prints of the last 20 is refused', async () => {
    const state = billDoc({
      jobs: [{ item_id: 'OIL', lot_id: 'lotO', printed: 40, reprinted: 0 }],
    });
    const seen: string[] = [];
    const { svc } = service(state, seen);
    const first = await svc.prepareDocJob({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR },
      lines: [printLine()],
    });
    const second = await svc.prepareDocJob({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR },
      lines: [printLine()],
    });
    expect(first.source).toEqual({
      docType: 'PURCHASE_BILL',
      docId: BILL,
      accYear: YEAR,
      refno: 'PUR/2026-2027/D8/01177',
    });
    const tx = fakeDb(state, seen) as unknown as Prisma.TransactionClient;
    seen.length = 0;
    await first.guard(tx);
    expect(seen[0]).toContain('pg_advisory_xact_lock(hashtextextended(');
    expect(seen.findIndex((sql) => sql.includes('AS reprinted'))).toBeGreaterThan(0);
    // the first job commits its 20 …
    state.jobs = [{ item_id: 'OIL', lot_id: 'lotO', printed: 60, reprinted: 0 }];
    // … so the second, which waited on the lock, finds nothing left
    await expect(second.guard(tx)).rejects.toMatchObject({
      response: {
        errors: [
          expect.objectContaining({
            code: 'STICKER_DOC_OVER_LEFT',
            params: {
              doc: 'PUR/2026-2027/D8/01177',
              item: 'ZT OIL',
              printed: 60,
              needed: 60,
              left: 0,
            },
            meta: { itemId: 'OIL', lotId: 'lotO', needed: 60, printed: 60, carried: 0, left: 0 },
          }),
        ],
      },
    });
  });

  it('over left with some left → rule=LEFT; lines of one item + lot add up', async () => {
    const state = billDoc({
      jobs: [{ item_id: 'OIL', lot_id: 'lotO', printed: 40, reprinted: 0 }],
    });
    const { svc } = service(state);
    const prepared = await svc.prepareDocJob({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR },
      lines: [printLine({ labels: 15 }), printLine({ labels: 6 })],
    });
    const tx = fakeDb(state) as unknown as Prisma.TransactionClient;
    expect(await codeOf(prepared.guard(tx))).toBe('422:STICKER_DOC_OVER_LEFT/LEFT@1');
  });

  it('a document cancelled while the job waited is refused under the lock', async () => {
    const state = billDoc();
    const { svc } = service(state);
    const prepared = await svc.prepareDocJob({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR },
      lines: [printLine()],
    });
    state.head = headRow({ status: 'CANCELLED' });
    expect(await codeOf(prepared.guard(fakeDb(state) as unknown as Prisma.TransactionClient))).toBe(
      '422:STICKER_DOC_NOT_POSTED',
    );
  });
});

describe('Review fixes F1 / F2 / F4 / F9 (2026-11-26)', () => {
  it('F2: printed and carried leave out a reprint’s copies; they count as reprinted (grid 224 rule)', async () => {
    const seen: string[] = [];
    const grnLine = { grn_line_id: 'G-L1', grn_id: 'G1', grn_year: YEAR, grn_refno: 'GRN/1' };
    await service(
      {
        head: headRow({ source_kind: 'GRN' }),
        lines: [lineRow('L1', 1, 'OIL', { factor: D(12), ...grnLine })],
        allocs: [{ line_id: 'L1', lot_id: 'lotO', qty: D(5), row_no: 1 }],
      },
      seen,
    ).svc.state(ref);
    const sums = seen.find((sql) => sql.includes('AS reprinted'))!.replace(/\s+/g, ' ');
    expect(sums).toContain(
      "WHERE j.lbj_kind = 'PRINT' AND l.lbjl_reprint_of_line_id IS NULL), 0)::int AS printed",
    );
    expect(sums).toContain(
      "WHERE j.lbj_kind = 'REPRINT' OR l.lbjl_reprint_of_line_id IS NOT NULL), 0)::int AS reprinted",
    );
    expect(sums).toContain("j.lbj_status <> 'FAILED'");
    const carried = seen.find((sql) => sql.includes('from_bills AS'))!.replace(/\s+/g, ' ');
    expect(carried).toContain(
      "WHERE j.lbj_kind = 'PRINT' AND j.lbj_status <> 'FAILED' AND l.lbjl_reprint_of_line_id IS NULL",
    );
  });

  it('F2: docs/state jobs[] carries reprint (a REPRINT or a resend of one) beside kind', async () => {
    const job = (id: string, kind: string, reprint: boolean) => ({
      lbj_id: id,
      lbj_refno: id,
      lbj_acc_year: YEAR,
      lbj_label_count: 2,
      lbj_kind: kind,
      reprint,
      lbj_status: 'PRINTED',
      lbj_printed_on: new Date('2026-11-26T05:00:00Z'),
    });
    const seen: string[] = [];
    const answer = await service(
      billDoc({
        jobList: [job('J1', 'PRINT', false), job('J2', 'REPRINT', true), job('J3', 'PRINT', true)],
      }),
      seen,
    ).svc.state(ref);
    expect(answer.jobs.map((entry) => [entry.jobId, entry.kind, entry.reprint])).toEqual([
      ['J1', 'PRINT', false],
      ['J2', 'REPRINT', true],
      ['J3', 'PRINT', true],
    ]);
    const list = seen
      .find((sql) => sql.includes('ORDER BY j.lbj_printed_on'))!
      .replace(/\s+/g, ' ');
    expect(list).toContain("(j.lbj_kind = 'REPRINT' OR EXISTS (");
    expect(list).toContain('l.lbjl_reprint_of_line_id IS NOT NULL)) AS reprint');
  });

  it('F9: a line starts at most at 9,999 labels; left keeps the whole', async () => {
    const answer = await service(
      billDoc({
        lines: [lineRow('L2', 2, 'OIL', { factor: D(12) })],
        allocs: [{ line_id: 'L2', lot_id: 'lotO', qty: D(1000), row_no: 1 }],
      }),
    ).svc.fromDoc(fromDocQuery);
    expect(answer.lines[0]).toMatchObject({ needed: 12000, left: 12000, labels: 9999 });
  });

  it('F4: the head carries the supplier’s Short name (blank → null)', async () => {
    const seen: string[] = [];
    const { svc } = service(billDoc({ head: headRow({ supplier_short: 'ZES' }) }), seen);
    const prepared = await svc.prepareDocJob({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR },
      lines: [{ itemId: 'OIL', unitId: 'def-OIL', lotId: 'lotO', labels: 1, srcLineId: 'L2' }],
    });
    expect(prepared.head.supplierShort).toBe('ZES');
    expect(seen.find((sql) => sql.includes('FROM purchase.pur_invoice p'))).toContain(
      "NULLIF(btrim(s.sup_short), '') AS supplier_short",
    );
  });

  describe('F1: checkDocResend (a resend of a FAILED document job)', () => {
    const args = (lines: Array<Record<string, unknown>>) => ({
      companyId: COMPANY,
      branchId: BRANCH,
      source: { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR },
      lines: lines as never,
    });
    const failedLine = {
      itemId: 'OIL',
      unitId: 'def-OIL',
      lotId: 'lotO',
      labels: 20,
      srcLineId: 'L2',
    };

    it('locks the document first, then reads it and counts; within left passes', async () => {
      const seen: string[] = [];
      const state = billDoc({
        jobs: [{ item_id: 'OIL', lot_id: 'lotO', printed: 40, reprinted: 0 }],
      });
      const tx = fakeDb(state, seen) as unknown as Prisma.TransactionClient;
      await service(state).svc.checkDocResend(tx, args([failedLine]));
      expect(seen[0]).toContain('pg_advisory_xact_lock(hashtextextended(');
      expect(seen[1]).toContain('FROM purchase.pur_invoice p');
      expect(seen.some((sql) => sql.includes('AS reprinted'))).toBe(true);
    });

    it('more than left → STICKER_DOC_OVER_LEFT with the print’s params / meta', async () => {
      const state = billDoc({
        jobs: [{ item_id: 'OIL', lot_id: 'lotO', printed: 60, reprinted: 0 }],
      });
      const tx = fakeDb(state) as unknown as Prisma.TransactionClient;
      await expect(service(state).svc.checkDocResend(tx, args([failedLine]))).rejects.toMatchObject(
        {
          status: 422,
          response: {
            errors: [
              expect.objectContaining({
                code: 'STICKER_DOC_OVER_LEFT',
                params: {
                  doc: 'PUR/2026-2027/D8/01177',
                  item: 'ZT OIL',
                  printed: 60,
                  needed: 60,
                  left: 0,
                },
                meta: {
                  itemId: 'OIL',
                  lotId: 'lotO',
                  needed: 60,
                  printed: 60,
                  carried: 0,
                  left: 0,
                },
              }),
            ],
          },
        },
      );
    });

    it('a document no longer POSTED → STICKER_DOC_NOT_POSTED, even with no print line to check', async () => {
      const state = billDoc({ head: headRow({ status: 'CANCELLED' }) });
      const tx = fakeDb(state) as unknown as Prisma.TransactionClient;
      expect(await codeOf(service(state).svc.checkDocResend(tx, args([failedLine])))).toBe(
        '422:STICKER_DOC_NOT_POSTED',
      );
      expect(await codeOf(service(state).svc.checkDocResend(tx, args([])))).toBe(
        '422:STICKER_DOC_NOT_POSTED',
      );
    });
  });
});
