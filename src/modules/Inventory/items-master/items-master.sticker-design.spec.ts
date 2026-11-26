import { ItemsMasterService } from './items-master.service';

/**
 * Sticker printing S-P1 (plan §7.3, §9.1 I1 / I2): the item card's Sticker
 * design must be a live, published label design of the item's company (or
 * shipped) when it is set and changed.
 */
type Check = (
  client: unknown,
  dto: Record<string, unknown>,
  existing: unknown,
  companyId: string | null,
) => Promise<void>;

function check(found: boolean): { run: Check; queries: string[] } {
  const queries: string[] = [];
  const client = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      queries.push(strings.join('?'));
      return Promise.resolve(found ? [{ ok: 1 }] : []);
    }),
  };
  const service = Object.create(ItemsMasterService.prototype) as { assertStickerDesign: Check };
  return {
    run: (_client, dto, existing, companyId) =>
      service.assertStickerDesign(client, dto, existing, companyId),
    queries,
  };
}

describe('ItemsMasterService — Sticker design (ITEM_STICKER_DESIGN_INVALID)', () => {
  it('a published label design passes; the query asks for a label purpose and a label sheet', async () => {
    const { run, queries } = check(true);
    await expect(run(null, { item_barcode_sticker_id: 'd1' }, null, 'c1')).resolves.toBeUndefined();
    expect(queries[0]).toContain("'ITEM_LABEL', 'PACK_LABEL', 'SHELF_LABEL'");
    expect(queries[0]).toContain('ptv_label_width_mm IS NOT NULL');
  });
  it('anything else is a 422 ITEM_STICKER_DESIGN_INVALID on item_barcode_sticker_id', async () => {
    const { run } = check(false);
    await expect(
      run(null, { item_barcode_sticker_id: 'invoice-design' }, null, 'c1'),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          expect.objectContaining({
            code: 'ITEM_STICKER_DESIGN_INVALID',
            field: 'item_barcode_sticker_id',
          }),
        ],
      },
    });
  });
  it('null clears and an unchanged value is not re-checked', async () => {
    const { run, queries } = check(false);
    await run(null, { item_barcode_sticker_id: null }, null, 'c1');
    await run(null, { item_barcode_sticker_id: 'd1' }, { itemBarcodeStickerId: 'd1' }, 'c1');
    expect(queries).toEqual([]);
  });
});
