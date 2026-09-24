import {
  ACC_YEAR,
  ACTOR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  DEVICE_ID,
  LISTED_CUSTOMER,
  LISTED_CUSTOMER_NAME,
  TENDER,
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  bootApp,
  codesOf,
  explain,
  grantSalesRights,
  makeItem,
  num,
  postOpeningStock,
  probes,
  revokeSalesRights,
  runTag,
  saleReturnBody,
  saleReturnKeys,
  shutdown,
  today,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales-e2e.harness';

/**
 * The server half of the Qt client's live bill run of 2026-09-24. Each case is
 * one numbered item of that report, driven through HTTP against the live DB:
 *
 *   1/2 · /master-lookup/item-price answers the item's real GST rate and HSN
 *   3   · a bill that set off a credit note can be cancelled
 *   5   · /bills/amend of a POSTED bill, twice, keeps its number
 *   6   · a second /bills/retender of the same bill
 *   7   · /sale-orders/create with an advance tender, and /sale-orders/post
 *   8   · an overridable WARN stays a WARN on /bills/validate
 */

const tag = runTag();
const SALE_BILL = 'SALE_BILL';

describe('Qt bill report 2026-09-24 (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);
  const get = (path: string, query: Record<string, string>) =>
    h.http.get(`${API}/${path}`).set('Authorization', BEARER).query(query);

  async function postedBill(body: Record<string, unknown>, label: string) {
    const created = explain(`${label} create`, await post('bills/create', body), 201);
    expect(created.status).toBe(201);
    const posted = explain(
      `${label} post`,
      await post('bills/post', billKeys(created.body.data.sbId)),
      201,
    );
    expect(posted.status).toBe(201);
    return posted.body.data as Record<string, any>;
  }

  beforeAll(async () => {
    h = await bootApp(`e2e-qtreport-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-QTR-${tag}`);
    await postOpeningStock(h, item, 200, 20, `E2E-QTR-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  it('1/2 · the item-price lookup answers the rate on tax_rate_master, and the HSN', async () => {
    const [row] = await h.prisma.$queryRaw<
      { item_id: string; item_hsn_code: string | null; tax_id: string; tax_rate_perc: unknown }[]
    >`
      SELECT i.item_id, i.item_hsn_code, t.tax_id, t.tax_rate_perc
        FROM inventory.item_master i
        JOIN inventory.tax_rate_master t ON t.tax_id = i.item_default_tax_id
       WHERE i.item_is_deleted = false AND t.tax_rate_perc > 0 AND i.item_hsn_code IS NOT NULL
         AND EXISTS (SELECT 1 FROM inventory.item_price_master m
                      WHERE m.ipm_item_id = i.item_id AND m.ipm_is_deleted = false)
       LIMIT 1`;
    expect(row).toBeDefined();
    const res = await get('master-lookups/item-price', { item_id: row.item_id, price_level: '1' });
    expect(res.status).toBe(200);
    const d = res.body.data;
    const rate = num(row.tax_rate_perc);
    expect(d.tax_id).toBe(row.tax_id);
    expect(d.hsn_code).toBe(row.item_hsn_code);
    expect(d.gst_rate).toBe(rate);
    expect(d.cgst_perc).toBe(rate / 2);
    expect(d.sgst_perc).toBe(rate / 2);
    expect(d.igst_perc).toBe(rate);
  });

  it('3 · a bill that set off a credit note can be cancelled', async () => {
    // A cash bill, returned whole on ADVANCE: an open credit note of 1,180.
    const source = await postedBill(
      billBody({
        custId: LISTED_CUSTOMER,
        custName: LISTED_CUSTOMER_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        usrRefno: `E2E-QTR-${tag}-SRC`,
      }),
      'source bill',
    );
    const created = explain(
      'return create',
      await post(
        'sale-returns/create',
        saleReturnBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          bill: { sbId: source.sbId, refno: source.sbBillRefno },
          lines: [{ item, qty: 10, rate: 100, sbiId: source.items[0].sbiId, costRate: 20 }],
          settleMode: 'ADVANCE',
          usrRefno: `E2E-QTR-${tag}-SR`,
          reason: `E2E-QTR-${tag} credit note`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    const ret = explain(
      'return post',
      await post('sale-returns/post', saleReturnKeys(created.body.data.srId)),
      201,
    );
    expect(ret.status).toBe(201);
    const [cn] = await p.balanceRows('SALE_RETURN', ret.body.data.srId);
    expect(num(cn.abl_pending_amount)).toBe(1180);

    // A bill of 590 paid by setting 590 of that credit note off.
    const adjustments = [{ againstBillId: cn.abl_id, againstBillAccYear: ACC_YEAR, amount: 590 }];
    const bodyWith = (extra: Record<string, unknown>) =>
      billBody({
        custId: LISTED_CUSTOMER,
        custName: LISTED_CUSTOMER_NAME,
        lines: [{ item, qty: 5, rate: 100 }],
        tenders: [],
        usrRefno: `E2E-QTR-${tag}-SETOFF`,
        extra: { ...extra, adjustments },
      });

    // 4 · a credit note is not an advance: sbAdvanceAmt cannot carry it.
    const wrong = await post('bills/create', bodyWith({ sbAdvanceAmt: 590 }));
    expect(wrong.status).toBe(400);
    expect(JSON.stringify(wrong.body.errors)).toContain('sbNoteAdjAmt');

    const draft = explain(
      'set-off create',
      await post('bills/create', bodyWith({ sbNoteAdjAmt: 590 })),
      201,
    );
    expect(draft.status).toBe(201);
    const posted = explain(
      'set-off post',
      await post('bills/post', { ...billKeys(draft.body.data.sbId), adjustments }),
      201,
    );
    expect(posted.status).toBe(201);
    const bill = posted.body.data as Record<string, any>;
    expect(num(bill.sbNoteAdjAmt)).toBe(590);
    expect(num(bill.sbAdvanceAmt)).toBe(0);
    expect(bill.sbPayStatus).toBe('PAID');
    const [cnAfter] = await p.balanceRows('SALE_RETURN', ret.body.data.srId);
    expect(num(cnAfter.abl_pending_amount)).toBe(590);
    // The credit note already credited the party: the set-off moves no ledger.
    // The bill debits the party 590 and nothing credits it back, so the party
    // nets to the 1,180 note less this 590.
    const legs = await p.legs(bill.sbPostedVoucherId);
    expect(legs.some((l) => (l.av_role ?? '').trim() === 'ADVANCE_RECEIVED')).toBe(false);
    expect(await p.partyNet(LISTED_CUSTOMER, bill.sbId)).toBe(590);

    const cancelled = explain(
      'set-off cancel',
      await post('bills/cancel', {
        ...billKeys(draft.body.data.sbId),
        reason: `E2E-QTR-${tag} cancel a set-off bill`,
      }),
      201,
    );
    expect(cancelled.status).toBe(201);
    // The credit note has its 590 back.
    const [cnBack] = await p.balanceRows('SALE_RETURN', ret.body.data.srId);
    expect(num(cnBack.abl_pending_amount)).toBe(1180);
  });

  it('5 · /bills/amend of a POSTED bill, twice: same number, one live voucher', async () => {
    const bill = await postedBill(
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 2, rate: 100 }],
        usrRefno: `E2E-QTR-${tag}-AMEND`,
      }),
      'amend bill',
    );
    let revision = Number(bill.sbRevisionNo);
    const voucherId = bill.sbPostedVoucherId;
    const onHandBefore = num((await p.balance(item.itemId))!.sbl_on_hand_qty);
    for (const qty of [3, 4]) {
      const res = explain(
        `amend to ${qty}`,
        await post('bills/amend', {
          ...billBody({
            custId: WALK_IN,
            custName: WALK_IN_NAME,
            lines: [{ item, qty, rate: 100 }],
            usrRefno: `E2E-QTR-${tag}-AMEND`,
          }),
          ...billKeys(bill.sbId),
          baseRevision: revision,
          editRemark: `E2E-QTR-${tag} qty ${qty}`,
        }),
        201,
      );
      expect(res.status).toBe(201);
      const after = res.body.data as Record<string, any>;
      expect(after.sbStatus).toBe('POSTED');
      expect(after.sbBillRefno).toBe(bill.sbBillRefno);
      expect(Number(after.sbRevisionNo)).toBe(revision + 1);
      expect(num(after.sbBillAmt)).toBe(qty * 118);
      revision = Number(after.sbRevisionNo);

      const live = (await p.vouchers(SALE_BILL, bill.sbId)).filter(
        (v) => v.avh_voucher_status.trim() === 'POSTED',
      );
      expect(live).toHaveLength(1);
      expect(live[0].avh_voucher_refno).toBe(bill.sbBillRefno);
      expect(num(live[0].avh_doc_amount)).toBe(qty * 118);
      // Restated in place: the same voucher, its revision moved, legs balanced.
      expect(live[0].avh_voucher_id).toBe(voucherId);
      expect(after.sbPostedVoucherId).toBe(voucherId);
      expect(num(live[0].avh_total_debit)).toBe(num(live[0].avh_total_credit));
      expect(await p.partyNet(WALK_IN, bill.sbId)).toBe(0);
      const [abl] = await p.balanceRows(SALE_BILL, bill.sbId);
      expect(num(abl.abl_bill_amount)).toBe(qty * 118);
      // One live GST register row, for the new figures.
      const reg = await p.register(bill.sbId);
      expect(reg).toHaveLength(1);
      expect(num(reg[0].gdr_bill_value)).toBe(qty * 118);
      // The goods: the old quantity came back, the new one went out.
      expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(onHandBefore + 2 - qty);
    }
    // No mirror voucher was drawn: the bill series has no gap for an amend.
    const [mirrors] = await h.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM accounts.acc_voucher_header
       WHERE avh_against_voucher_id = ${voucherId}::uuid AND avh_is_deleted = false`;
    expect(Number(mirrors.n)).toBe(0);
  });

  it('6 · a second /bills/retender of the same bill', async () => {
    const bill = await postedBill(
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-QTR-${tag}-RETENDER`,
      }),
      'retender bill',
    );
    const swaps = [
      { to: TENDER.UPI, ref: `UTR-QTR-${tag}-1` },
      { to: TENDER.CASH, ref: undefined },
    ];
    for (const [n, swap] of swaps.entries()) {
      const live = (await p.tenders(SALE_BILL, bill.sbId)).filter((t) => !t.td_is_voided);
      expect(live).toHaveLength(1);
      const res = explain(
        `retender ${n + 1}`,
        await post('bills/retender', {
          ...billKeys(bill.sbId),
          voids: [{ tdId: live[0].td_id, reason: 'KEYED_WRONG' }],
          tenders: [
            { tdTenderId: swap.to, tdAmount: 118, ...(swap.ref ? { tdRefNo: swap.ref } : {}) },
          ],
          remark: `E2E-QTR-${tag} retender ${n + 1}`,
        }),
        201,
      );
      expect(res.status).toBe(201);
    }
    const contras = await p.retenderContras(bill.sbId);
    expect(contras.filter((v) => v.avh_voucher_status.trim() === 'POSTED')).toHaveLength(2);
    expect(contras.map((v) => v.avh_doc_refno)).toEqual([
      `${bill.sbBillRefno}/RT1`,
      `${bill.sbBillRefno}/RT2`,
    ]);
  });

  describe('7 · sale orders', () => {
    const orderBody = (withTender: boolean) => ({
      soCompanyId: COMPANY,
      soBranchId: BRANCH,
      soAccYear: ACC_YEAR,
      soDeviceId: DEVICE_ID,
      soPriceLevel: 1,
      soCustId: LISTED_CUSTOMER,
      soCustName: LISTED_CUSTOMER_NAME,
      soCustStcd: '33',
      soPosStcd: '33',
      soUserId: ACTOR,
      soUsrRefno: `E2E-QTR-${tag}-SO-${withTender ? 'T' : 'P'}`,
      soOrderDate: today(),
      soTotItems: 1,
      soGrossAmt: 200,
      soTaxableAmt: 200,
      soCgstAmt: 18,
      soSgstAmt: 18,
      soTaxAmt: 36,
      soOrderAmt: 236,
      items: [
        {
          soiLineNo: 1,
          soiItemId: item.itemId,
          soiItemUnitId: item.iucId,
          soiGodownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
          soiOrderQty: 2,
          soiRate: 100,
          soiGrossAmt: 200,
          soiTaxableAmt: 200,
          soiTaxPerc: 18,
          soiCgstPerc: 9,
          soiCgstAmt: 18,
          soiSgstPerc: 9,
          soiSgstAmt: 18,
          soiTaxAmt: 36,
          soiNetAmt: 236,
        },
      ],
      ...(withTender ? { tenders: [{ tdTenderId: TENDER.CASH, tdAmount: 100 }] } : {}),
    });

    it('/sale-orders/create with an advance tender', async () => {
      const res = explain(
        'order create (tender)',
        await post('sale-orders/create', orderBody(true)),
        201,
      );
      expect(res.status).toBe(201);
      // The advance receipt: POSTED, balanced, DR cash 100 / CR advance 100.
      const [voucher] = await p.vouchers('SALES_ORDER', res.body.data.soId);
      expect(voucher.avh_voucher_status.trim()).toBe('POSTED');
      expect(num(voucher.avh_total_debit)).toBe(100);
      expect(num(voucher.avh_total_credit)).toBe(100);
      expect(await p.legs(voucher.avh_voucher_id)).toHaveLength(2);
    });

    it('/sale-orders/post of a plain DRAFT confirms it; only then can a bill take it', async () => {
      const created = explain(
        'order create',
        await post('sale-orders/create', orderBody(false)),
        201,
      );
      expect(created.status).toBe(201);
      const d = created.body.data;
      // A bill line drawn from the order, as the whole-order import builds it.
      const billAgainstOrder = () => {
        const body = billBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 2, rate: 100 }],
          usrRefno: `E2E-QTR-${tag}-FROM-SO`,
        });
        const [line] = body.items as Record<string, unknown>[];
        Object.assign(line, {
          sbiSrcDocType: 'SALES_ORDER',
          sbiSrcDocId: d.soId,
          sbiSrcDocYear: ACC_YEAR,
          sbiSrcDocRefno: d.soOrderRefno,
          sbiSrcDocLineNo: 1,
          sbiSrcItemId: d.items[0].soiId,
          sbiSrcItemQty: 2,
        });
        return body;
      };
      // Observation · a DRAFT order is not billable.
      const early = await post('bills/validate', billAgainstOrder());
      expect(early.status).toBe(201);
      expect((early.body.data.refusals as Record<string, any>[]).map((r) => r.code)).toContain(
        'SALES_ORDER_NOT_OPEN',
      );

      const res = explain(
        'order post',
        await post('sale-orders/post', {
          soId: d.soId,
          soCompanyId: COMPANY,
          soBranchId: BRANCH,
          soAccYear: ACC_YEAR,
        }),
        201,
      );
      expect(res.status).toBe(201);
      expect(res.body.data.soStatus).toBe('CONFIRMED');

      const late = await post('bills/validate', billAgainstOrder());
      expect(late.status).toBe(201);
      expect((late.body.data.refusals as Record<string, any>[]).map((r) => r.code)).not.toContain(
        'SALES_ORDER_NOT_OPEN',
      );
    });
  });

  it('observation · sbiBucket: null is a 400 naming the field, not a 500', async () => {
    const body = billBody({
      custId: WALK_IN,
      custName: WALK_IN_NAME,
      lines: [{ item, qty: 1, rate: 100 }],
      usrRefno: `E2E-QTR-${tag}-BUCKET`,
    });
    (body.items as Record<string, unknown>[])[0].sbiBucket = null;
    const res = await post('bills/create', body);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.errors)).toContain('sbiBucket');
  });

  it('8 · an overridable WARN is a WARN on /bills/validate, not a refusal', async () => {
    const res = await post(
      'bills/validate',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-QTR-${tag}-BACKDATE`,
        billDate: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10),
      }),
    );
    expect(res.status).toBe(201);
    const warnings = (res.body.data.warnings ?? []) as Record<string, any>[];
    const refusals = (res.body.data.refusals ?? []) as Record<string, any>[];
    if (!warnings.some((w) => w.code === 'SALES_BACKDATE')) {
      // The company allows this much backdating: nothing to override.
      return;
    }
    expect(refusals.map((r) => r.code)).not.toContain('SALES_BACKDATE');
    expect(codesOf(res)).not.toContain('SALES_BACKDATE_REFUSED');
  });
});
