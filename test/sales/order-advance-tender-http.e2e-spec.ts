import {
  ACC_YEAR,
  ACTOR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  DEVICE_ID,
  GODOWN,
  LISTED_CUSTOMER,
  LISTED_CUSTOMER_NAME,
  TENDER,
  TENDER_LEDGER,
  billBody,
  billKeys,
  bootApp,
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
 * The two items the Qt run left open on 2026-09-24 (end of day):
 *
 *   · /sale-orders/create with an advance tender row, in the fullest shape the
 *     tender DTO takes (tender ledger, the three amounts, a settle status);
 *   · the order advance set off on a bill that ALSO sets off a credit note —
 *     bil00476's shape — and that bill cancelled. Its 500 was a 23505 on
 *     ux_avh_voucher_slno: allocateVoucherSlno's advisory lock sat in an
 *     unreferenced CTE, so a concurrent /cheques/re-present took the same slno.
 */

const tag = runTag();

describe('order advance, set off on a bill with a credit note (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);

  const orderBody = (tenders: Record<string, unknown>[]) => ({
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
    soUsrRefno: `E2E-OAT-${tag}-SO`,
    soOrderDate: today(),
    soTotItems: 1,
    soGrossAmt: 500,
    soTaxableAmt: 500,
    soCgstAmt: 45,
    soSgstAmt: 45,
    soTaxAmt: 90,
    soOrderAmt: 590,
    items: [
      {
        soiLineNo: 1,
        soiItemId: item.itemId,
        soiItemUnitId: item.iucId,
        soiGodownId: GODOWN,
        soiOrderQty: 5,
        soiRate: 100,
        soiGrossAmt: 500,
        soiTaxableAmt: 500,
        soiTaxPerc: 18,
        soiCgstPerc: 9,
        soiCgstAmt: 45,
        soiSgstPerc: 9,
        soiSgstAmt: 45,
        soiTaxAmt: 90,
        soiNetAmt: 590,
      },
    ],
    tenders,
  });

  beforeAll(async () => {
    h = await bootApp(`e2e-oat-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-OAT-${tag}`);
    await postOpeningStock(h, item, 100, 20, `E2E-OAT-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  it('an order takes an advance, a bill sets it off with a credit note, and the bill cancels', async () => {
    // 1 · the order, with a fully dressed advance tender row.
    const d = today();
    const order = explain(
      'order create',
      await post(
        'sale-orders/create',
        orderBody([
          {
            tdTenderId: TENDER.CASH,
            tdTenderLedgerId: TENDER_LEDGER.CASH,
            tdDrCr: 'DR',
            tdAmount: 300,
            tdTotalAmt: 300,
            tdReceivedAmt: 500,
            tdChangeAmt: 200,
            tdSettleStatus: 'SETTLED',
            tdSettledOn: d,
            tdSrcModule: 'SALES',
            tdSrcDocType: 'SALES_ORDER',
            tdPartyLedgerId: LISTED_CUSTOMER,
            tdDocDate: d,
            tdUserId: ACTOR,
          },
        ]),
      ),
      201,
    );
    expect(order.status).toBe(201);
    const so = order.body.data as Record<string, any>;
    const [advVoucher] = await p.vouchers('SALES_ORDER', so.soId);
    expect(advVoucher.avh_voucher_status.trim()).toBe('POSTED');
    expect(num(advVoucher.avh_total_debit)).toBe(300);
    expect(num(advVoucher.avh_total_credit)).toBe(300);
    const [adv] = await p.balanceRows('SALES_ORDER', so.soId);
    expect(num(adv.abl_pending_amount)).toBe(300);

    const confirmed = explain(
      'order post',
      await post('sale-orders/post', {
        soId: so.soId,
        soCompanyId: COMPANY,
        soBranchId: BRANCH,
        soAccYear: ACC_YEAR,
      }),
      201,
    );
    expect(confirmed.status).toBe(201);

    // 2 · a credit note of 118 for the same customer.
    const source = explain(
      'source bill create',
      await post(
        'bills/create',
        billBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 1, rate: 100 }],
          usrRefno: `E2E-OAT-${tag}-SRC`,
        }),
      ),
      201,
    );
    const sourcePosted = explain(
      'source bill post',
      await post('bills/post', billKeys(source.body.data.sbId)),
      201,
    );
    const src = sourcePosted.body.data as Record<string, any>;
    const ret = explain(
      'return create',
      await post(
        'sale-returns/create',
        saleReturnBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          bill: { sbId: src.sbId, refno: src.sbBillRefno },
          lines: [{ item, qty: 1, rate: 100, sbiId: src.items[0].sbiId, costRate: 20 }],
          settleMode: 'ADVANCE',
          usrRefno: `E2E-OAT-${tag}-SR`,
          reason: `E2E-OAT-${tag} credit note`,
        }),
      ),
      201,
    );
    const retPosted = explain(
      'return post',
      await post('sale-returns/post', saleReturnKeys(ret.body.data.srId)),
      201,
    );
    const [cn] = await p.balanceRows('SALE_RETURN', retPosted.body.data.srId);
    expect(num(cn.abl_pending_amount)).toBe(118);

    // 3 · the order billed: 590, of which 300 is the advance and 118 the note.
    const adjustments = [
      { againstBillId: adv.abl_id, againstBillAccYear: ACC_YEAR, amount: 300 },
      { againstBillId: cn.abl_id, againstBillAccYear: ACC_YEAR, amount: 118 },
    ];
    const body = billBody({
      custId: LISTED_CUSTOMER,
      custName: LISTED_CUSTOMER_NAME,
      lines: [{ item, qty: 5, rate: 100 }],
      tenders: [{ tenderId: TENDER.CASH, amount: 172 }],
      usrRefno: `E2E-OAT-${tag}-BILL`,
      extra: { sbAdvanceAmt: 300, sbNoteAdjAmt: 118, adjustments },
    });
    Object.assign((body.items as Record<string, unknown>[])[0], {
      sbiSrcDocType: 'SALES_ORDER',
      sbiSrcDocId: so.soId,
      sbiSrcDocYear: ACC_YEAR,
      sbiSrcDocRefno: so.soOrderRefno,
      sbiSrcDocLineNo: 1,
      sbiSrcItemId: so.items[0].soiId,
      sbiSrcItemQty: 5,
    });
    const draft = explain('bill create', await post('bills/create', body), 201);
    expect(draft.status).toBe(201);
    const posted = explain(
      'bill post',
      await post('bills/post', { ...billKeys(draft.body.data.sbId), adjustments }),
      201,
    );
    expect(posted.status).toBe(201);
    const bill = posted.body.data as Record<string, any>;
    expect(num(bill.sbAdvanceAmt)).toBe(300);
    expect(num(bill.sbNoteAdjAmt)).toBe(118);
    const [advAfter] = await p.balanceRows('SALES_ORDER', so.soId);
    expect(num(advAfter.abl_pending_amount)).toBe(0);
    const [cnAfter] = await p.balanceRows('SALE_RETURN', retPosted.body.data.srId);
    expect(num(cnAfter.abl_pending_amount)).toBe(0);
    const legs = await p.legs(bill.sbPostedVoucherId);
    // Both credits sit on the party itself (the order names no advance ledger;
    // a credit note credits the party), so the set-offs move no ledger: the
    // bill debits the party 590 and only the cash 172 comes back
    // (bill-adjustment.helper, loadSetOffCredits).
    expect(legs.some((l) => (l.av_role ?? '').trim() === 'ADVANCE_RECEIVED')).toBe(false);
    const party = legs.filter((l) => l.av_ledger_id === LISTED_CUSTOMER);
    expect(party.map((l) => [l.av_dr_cr.trim(), num(l.av_amount)])).toEqual([
      ['DR', 590],
      ['CR', 172],
    ]);

    // 4 · cancelled: both set-offs come back open.
    const cancelled = explain(
      'bill cancel',
      await post('bills/cancel', {
        ...billKeys(draft.body.data.sbId),
        reason: `E2E-OAT-${tag} cancel advance + note set-off`,
      }),
      201,
    );
    expect(cancelled.status).toBe(201);
    const [advBack] = await p.balanceRows('SALES_ORDER', so.soId);
    expect(num(advBack.abl_pending_amount)).toBe(300);
    const [cnBack] = await p.balanceRows('SALE_RETURN', retPosted.body.data.srId);
    expect(num(cnBack.abl_pending_amount)).toBe(118);
  }, 180_000);
});
