import { Prisma } from '@prisma/client';
import { challanDrawsOf } from './order-challan-draws';

const D = (v: string | number) => new Prisma.Decimal(v);
const L1 = '019c6f6c-be87-7a11-8905-36092c46a511';
const L2 = '019c6f6c-be87-7a11-8905-36092c46a512';

describe('challanDrawsOf (user 11-17)', () => {
  it('nets each line\'s POSTED challans against their POSTED returns, by line number', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [
        { soi_id: L1, dc_qty: D('4.000'), returned_qty: D('1.000'), dc_billed_amt: D('236.00') },
        { soi_id: L2, dc_qty: null, returned_qty: null, dc_billed_amt: null },
      ]),
    };

    const out = await challanDrawsOf(tx as never, '2026-2027', [
      { soiId: L1, soiLineNo: 1 },
      { soiId: L2, soiLineNo: 2 },
    ]);

    expect([...out.entries()]).toEqual([[1, { qty: D('3'), billedAmt: D('236') }]]);
    const [strings, ids, year] = tx.$queryRaw.mock.calls[0] as unknown as [string[], string[], string];
    const sql = strings.join('?');
    expect(ids).toEqual([L1, L2]);
    expect(year).toBe('2026-2027');
    // drafts / cancelled / deleted never count; a bill of a challan is not read at all
    expect(sql).toContain("h.sdc_status = 'POSTED'");
    expect(sql).toContain("rh.sdr_status = 'POSTED'");
    expect(sql).toContain('h.sdc_is_deleted = false');
    // the bills read here are bills of the CHALLAN (money only); an order's own bills are not
    expect(sql).toContain("b.sbi_src_doc_type = 'DELIVERY_CHALLAN'");
    expect(sql).not.toContain("sbi_src_doc_type = 'SALES_ORDER'");
    expect(sql).toContain("bh.sb_status = 'POSTED'");
    // the order line's own unit, else through base units
    expect(sql).toContain('WHEN d.sdi_item_unit_id = o.soi_item_unit_id THEN d.sdi_dc_qty');
    expect(sql).toContain('/ COALESCE(NULLIF(o.soi_to_base_factor, 0), 1)');
    expect(sql).not.toContain('sdi_free_qty');
  });

  it('keeps a line whose challans were all returned, at 0', async () => {
    const tx = { $queryRaw: jest.fn(async () => [{ soi_id: L1, dc_qty: D('2'), returned_qty: D('2') }]) };

    const out = await challanDrawsOf(tx as never, '2026-2027', [{ soiId: L1, soiLineNo: 1 }]);

    expect(out.get(1)).toEqual({ qty: D('0'), billedAmt: D('0') });
  });

  it('asks nothing for no lines, and ignores rows of other lines', async () => {
    const tx = { $queryRaw: jest.fn(async () => [{ so_id: 'x' }]) };

    await expect(challanDrawsOf(tx as never, '2026-2027', [])).resolves.toEqual(new Map());
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    await expect(challanDrawsOf(tx as never, '2026-2027', [{ soiId: L1, soiLineNo: 1 }])).resolves.toEqual(new Map());
  });
});
