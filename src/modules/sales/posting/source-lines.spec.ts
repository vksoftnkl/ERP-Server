import { BILL_SOURCE_KEYS, DC_SOURCE_KEYS, resolveSourceLines } from './source-lines';

/**
 * P4 (user 2026-11-17) — one resolver for a line's source, both body shapes:
 * the Qt's (the line id AND order id + line no + year) and the bare
 * document + line number (or a line id in …SrcDocId).
 */
const SO = '019c6f6c-be87-7a11-8905-36092c46e001';
const SOI1 = '019c6f6c-be87-7a11-8905-36092c46e011';
const SOI2 = '019c6f6c-be87-7a11-8905-36092c46e012';
const DC = '019c6f6c-be87-7a11-8905-36092c46e021';
const SDI1 = '019c6f6c-be87-7a11-8905-36092c46e031';
const SDI1B = '019c6f6c-be87-7a11-8905-36092c46e032';
const SDI2 = '019c6f6c-be87-7a11-8905-36092c46e033';
const YEAR = '2026-2027';

const orderRows = [
  { id: SOI1, doc_id: SO, line_no: 1, acc_year: `${YEAR}` },
  { id: SOI2, doc_id: SO, line_no: 2, acc_year: `${YEAR}` },
];
// line 1 of the challan is a batch split: two rows share the line number
const challanRows = [
  { id: SDI1, doc_id: DC, line_no: 1, acc_year: YEAR },
  { id: SDI1B, doc_id: DC, line_no: 1, acc_year: YEAR },
  { id: SDI2, doc_id: DC, line_no: 2, acc_year: YEAR },
];
const txOf = () => ({
  $queryRaw: jest.fn(async (strings: TemplateStringsArray) =>
    strings.join('?').includes('sales.sale_order_item') ? orderRows : challanRows,
  ),
});

describe('resolveSourceLines (P4)', () => {
  it('keeps the Qt challan body as it is (line id + order id + line no + year)', async () => {
    const line = { sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SO, sdiSrcDocAccYear: YEAR, sdiSrcItemId: SOI1, sdiSrcLineNo: 1 };
    const out = await resolveSourceLines(txOf() as never, [line], DC_SOURCE_KEYS, ['SALES_ORDER']);
    expect(out).toEqual({ unresolved: [], changed: [] });
    expect(line).toMatchObject({ sdiSrcItemId: SOI1, sdiSrcDocId: SO, sdiSrcLineNo: 1, sdiSrcDocAccYear: YEAR });
  });

  it('resolves the order + line number shape (no line id) to the order line', async () => {
    const line: Record<string, unknown> = { sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SO, sdiSrcLineNo: 2 };
    const out = await resolveSourceLines(txOf() as never, [line], DC_SOURCE_KEYS, ['SALES_ORDER']);
    expect(out).toEqual({ unresolved: [], changed: [0] });
    expect(line).toMatchObject({ sdiSrcItemId: SOI2, sdiSrcDocId: SO, sdiSrcLineNo: 2, sdiSrcDocAccYear: YEAR });
  });

  it('resolves a line id sent in …SrcDocId (the line grain), and a line number sent as text', async () => {
    const a: Record<string, unknown> = { sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SOI1 };
    const b: Record<string, unknown> = { sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SO, sdiSrcLineNo: '1' };
    await resolveSourceLines(txOf() as never, [a, b], DC_SOURCE_KEYS, ['SALES_ORDER']);
    expect(a).toMatchObject({ sdiSrcItemId: SOI1, sdiSrcDocId: SO, sdiSrcLineNo: 1 });
    expect(b).toMatchObject({ sdiSrcItemId: SOI1, sdiSrcLineNo: 1 });
  });

  it('lets the line id win over a line number that disagrees', async () => {
    const line: Record<string, unknown> = { sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SO, sdiSrcItemId: SOI2, sdiSrcLineNo: 1 };
    await resolveSourceLines(txOf() as never, [line], DC_SOURCE_KEYS, ['SALES_ORDER']);
    expect(line).toMatchObject({ sdiSrcItemId: SOI2, sdiSrcLineNo: 2 });
  });

  it('reports a reference that names no live line, and leaves an unsourced line alone', async () => {
    const tx = txOf();
    const lines: Record<string, unknown>[] = [
      { sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SO, sdiSrcLineNo: 9 },
      { sdiItemId: 'x' },
    ];
    const out = await resolveSourceLines(tx as never, lines, DC_SOURCE_KEYS, ['SALES_ORDER']);
    expect(out.unresolved).toEqual([0]);
    expect(lines[0].sdiSrcItemId).toBeUndefined();
    await expect(resolveSourceLines(tx as never, [{ sdiItemId: 'y' }], DC_SOURCE_KEYS, ['SALES_ORDER'])).resolves.toEqual({
      unresolved: [],
      changed: [],
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('resolves a bill\'s order line and challan line by the bill\'s own keys', async () => {
    const order: Record<string, unknown> = { sbiSrcDocType: 'SALES_ORDER', sbiSrcDocId: SO, sbiSrcDocLineNo: 1 };
    const challan: Record<string, unknown> = { sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcDocId: DC, sbiSrcDocLineNo: 2 };
    const out = await resolveSourceLines(txOf() as never, [order, challan], BILL_SOURCE_KEYS, ['SALES_ORDER', 'DELIVERY_CHALLAN']);
    expect(out.unresolved).toEqual([]);
    expect(order).toMatchObject({ sbiSrcItemId: SOI1, sbiSrcDocId: SO, sbiSrcDocLineNo: 1, sbiSrcDocYear: YEAR });
    expect(challan).toMatchObject({ sbiSrcItemId: SDI2, sbiSrcDocId: DC, sbiSrcDocLineNo: 2 });
  });

  it('does not guess a challan line number shared by a batch split; the line id still resolves', async () => {
    const split: Record<string, unknown> = { sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcDocId: DC, sbiSrcDocLineNo: 1 };
    const byId: Record<string, unknown> = { sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcItemId: SDI1B };
    const out = await resolveSourceLines(txOf() as never, [split, byId], BILL_SOURCE_KEYS, ['DELIVERY_CHALLAN']);
    expect(out.unresolved).toEqual([0]);
    expect(byId).toMatchObject({ sbiSrcDocId: DC, sbiSrcDocLineNo: 1, sbiSrcItemId: SDI1B });
  });
});
