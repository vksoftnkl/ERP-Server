import {
  API,
  BEARER,
  LISTED_CUSTOMER,
  LISTED_CUSTOMER_NAME,
  billBody,
  billKeys,
  bootApp,
  explain,
  grantSalesRights,
  makeItem,
  num,
  postOpeningStock,
  revokeSalesRights,
  runTag,
  shutdown,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales-e2e.harness';

/**
 * The Qt re-run of 2026-09-24 (afternoon): once /master-lookups/item-price
 * answered the real rate block (cgst 9 / sgst 9 / igst 18), the screen copied
 * all three onto the line and every /bills/post 500'd — the GST register's
 * chk_acc_voucher_doc_detail_supply_tax_logic refuses an IGST rate on an
 * INTRA_STATE row. And sbi_tax_id stayed NULL, because the save DTO has no
 * sbiTaxId and nothing stamped it.
 */

const tag = runTag();

describe('bill post with the lookup rate block (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let item: Item;
  let taxId: string;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);

  beforeAll(async () => {
    h = await bootApp(`e2e-rateblock-${tag}`);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-RB-${tag}`);
    const [rate] = await h.prisma.$queryRaw<{ tax_id: string }[]>`
      SELECT tax_id FROM inventory.tax_rate_master
       WHERE tax_rate_perc = 18 AND tax_is_deleted = false
       LIMIT 1`;
    taxId = rate.tax_id;
    await h.prisma.itemMaster.update({
      where: { itemId: item.itemId },
      data: { itemDefaultTaxId: taxId },
    });
    await postOpeningStock(h, item, 50, 20, `E2E-RB-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  it('an intra-state line carrying igst 18 posts, with the tax id stamped and IGST kept off the register', async () => {
    const body = billBody({
      custId: LISTED_CUSTOMER,
      custName: LISTED_CUSTOMER_NAME,
      lines: [{ item, qty: 2, rate: 100 }],
      usrRefno: `E2E-RB-${tag}`,
    });
    // Exactly what the screen sends off the lookup: the whole rate block.
    (body.items as Record<string, unknown>[])[0].sbiIgstPerc = 18;

    const created = explain('create', await post('bills/create', body), 201);
    expect(created.status).toBe(201);
    const sbId = created.body.data.sbId as string;

    const [line] = await h.prisma.$queryRaw<{ sbi_tax_id: string | null }[]>`
      SELECT sbi_tax_id FROM sales.sale_bill_item
       WHERE sbi_bill_id = ${sbId}::uuid AND sbi_is_deleted = false`;
    expect(line.sbi_tax_id).toBe(taxId);

    const posted = explain('post', await post('bills/post', billKeys(sbId)), 201);
    expect(posted.status).toBe(201);

    const detail = await h.prisma.$queryRaw<
      {
        vtx_tax_id: string | null;
        vtx_cgst_rate: unknown;
        vtx_sgst_rate: unknown;
        vtx_igst_rate: unknown;
      }[]
    >`
      SELECT d.vtx_tax_id, d.vtx_cgst_rate, d.vtx_sgst_rate, d.vtx_igst_rate
        FROM accounts.acc_voucher_doc_detail d
        JOIN accounts.acc_voucher_doc_register r
          ON r.gdr_id = d.vtx_gdr_id AND r.gdr_acc_year = d.vtx_acc_year
       WHERE r.gdr_source_doc_id = ${sbId}::uuid AND r.gdr_is_deleted = false`;
    expect(detail).toHaveLength(1);
    expect(detail[0].vtx_tax_id).toBe(taxId);
    expect(num(detail[0].vtx_cgst_rate)).toBe(9);
    expect(num(detail[0].vtx_sgst_rate)).toBe(9);
    expect(num(detail[0].vtx_igst_rate)).toBe(0);
  }, 120_000);
});
