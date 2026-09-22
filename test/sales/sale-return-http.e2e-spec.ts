import {
  API,
  BEARER,
  LISTED_CUSTOMER,
  LISTED_CUSTOMER_NAME,
  TENDER,
  TENDER_LEDGER,
  VCHR,
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
  type Harness,
  type Item,
  type RightsMemo,
} from './sales-e2e.harness';

/**
 * The sale return (credit note) in all three settlements, against the live
 * database — HANDOVER §4 item 5.
 *
 * One fresh item opened at 100 @ 20. Three bills of 10 @ 100 + 18% = 1,180:
 *
 *   A · cash, walk-in    → return 4 (472), settle CASH: refunded through the
 *                          tender, the CR row settles itself, no open credit
 *   B · part-paid credit → return all 10 (1,180), settle ADJUST: the ORIGINAL
 *       (500 cash + 680     bill's outstanding 680 is set off first; what is
 *        on credit)         left (500) stays an open credit on the CR row
 *   C · cash, walk-in    → return 3 (354), settle ADVANCE: nothing settles,
 *                          the whole 354 stays an open credit
 *
 * Each return moves the goods back IN at the cost they left at, mirrors the
 * bill's legs on an SRt voucher (SALES_RETURN, not a negative SALES), files a
 * CREDIT_NOTE register row with sign −1, and stamps the bill's returned
 * figures. Cancelling B's return gives the bill its outstanding back.
 */

const tag = runTag();
const SALE_BILL = 'SALE_BILL';
const SALE_RETURN = 'SALE_RETURN';

describe('Sale return — CASH, ADJUST and ADVANCE settlements (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  let billA: Record<string, any>;
  let billB: Record<string, any>;
  let billC: Record<string, any>;
  let returnA: Record<string, any>;
  let returnB: Record<string, any>;
  let returnC: Record<string, any>;

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
    expect(posted.body.data.sbStatus).toBe('POSTED');
    return posted.body.data as Record<string, any>;
  }

  beforeAll(async () => {
    h = await bootApp(`e2e-sr-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-SR-${tag}`);
    await postOpeningStock(h, item, 100, 20, `E2E-SR-${tag} opening`);

    billA = await postedBill(
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        usrRefno: `E2E-SR-${tag}-A`,
      }),
      'bill A',
    );
    billB = await postedBill(
      billBody({
        custId: LISTED_CUSTOMER,
        custName: LISTED_CUSTOMER_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        tenders: [
          { tenderId: TENDER.CASH, amount: 500 },
          { tenderId: TENDER.CREDIT, amount: 680 },
        ],
        usrRefno: `E2E-SR-${tag}-B`,
      }),
      'bill B',
    );
    billC = await postedBill(
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        usrRefno: `E2E-SR-${tag}-C`,
      }),
      'bill C',
    );
  }, 240_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  it('the three bills stand: 30 sold, bill B owes 680', async () => {
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(70);
    const [ablB] = await p.balanceRows(SALE_BILL, billB.sbId);
    expect(num(ablB.abl_bill_amount)).toBe(1180);
    expect(num(ablB.abl_alloc_amount)).toBe(500);
    expect(num(ablB.abl_pending_amount)).toBe(680);
    expect(billB.sbPayStatus).toBe('PARTIAL');
  });

  it('GET /sale-returns/bill-lines lists the bill lines with nothing returned yet', async () => {
    const res = await get('sale-returns/bill-lines', {
      sbId: billA.sbId,
      sbAccYear: billA.sbAccYear,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].billItemId).toBe(billA.items[0].sbiId);
    expect(num(res.body.data[0].billQty)).toBe(10);
    expect(num(res.body.data[0].returnedQty)).toBe(0);
    expect(res.body.data[0].returnable).toBe(true);
    expect(num(res.body.data[0].cost)).toBe(200);
  });

  it('a return of more than the bill sold is refused: 422 SALES_RETURN_OVER_QTY', async () => {
    const created = await post(
      'sale-returns/create',
      saleReturnBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        bill: { sbId: billA.sbId, refno: billA.sbBillRefno },
        lines: [{ item, qty: 11, rate: 100, sbiId: billA.items[0].sbiId, costRate: 20 }],
        settleMode: 'ADVANCE',
        usrRefno: `E2E-SR-${tag}-OVER`,
        reason: 'too many',
      }),
    );
    expect(created.status).toBe(201);
    const res = await post('sale-returns/post', saleReturnKeys(created.body.data.srId));
    expect(res.status).toBe(422);
    expect(codesOf(res)).toContain('SALES_RETURN_OVER_QTY');
    await post('sale-returns/delete', saleReturnKeys(created.body.data.srId));
  });

  // ─────────────────────────────────────────────────────────────── A · CASH

  it('CASH: 4 of bill A come back, refunded through the cash tender', async () => {
    const created = explain(
      'return A create',
      await post(
        'sale-returns/create',
        saleReturnBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          bill: { sbId: billA.sbId, refno: billA.sbBillRefno },
          lines: [{ item, qty: 4, rate: 100, sbiId: billA.items[0].sbiId, costRate: 20 }],
          settleMode: 'CASH',
          tenders: [{ tenderId: TENDER.CASH, amount: 472 }],
          usrRefno: `E2E-SR-${tag}-A`,
          reason: `E2E-SR-${tag} cash refund`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    expect(created.body.data.srStatus).toBe('DRAFT');
    expect(created.body.data.srBillRefno).toBe(billA.sbBillRefno);

    const validate = await post('sale-returns/validate', {
      ...saleReturnBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        bill: { sbId: billA.sbId, refno: billA.sbBillRefno },
        lines: [{ item, qty: 4, rate: 100, sbiId: billA.items[0].sbiId, costRate: 20 }],
        settleMode: 'CASH',
        usrRefno: `E2E-SR-${tag}-A`,
        reason: 'dry run',
      }),
      srId: created.body.data.srId,
    });
    expect(validate.status).toBe(201);
    expect(validate.body.data.ok).toBe(true);

    const posted = explain(
      'return A post',
      await post('sale-returns/post', saleReturnKeys(created.body.data.srId)),
      201,
    );
    expect(posted.status).toBe(201);
    returnA = posted.body.data;
    expect(returnA.srStatus).toBe('POSTED');
    expect(returnA.srSettleStatus).toBe('REFUNDED');
    expect(num(returnA.srRefundAmt)).toBe(472);
    expect(num(returnA.srAdjustedAmt)).toBe(0);
    expect(num(returnA.srCreditAmt)).toBe(0);
    expect(num(returnA.srTotalCost)).toBe(80);
    expect(returnA.posting.settlement).toEqual(
      expect.objectContaining({ refunded: 472, adjusted: 0, credited: 0 }),
    );

    // The goods, back IN at the cost they left at.
    const ledger = await p.stockLedger(SALE_RETURN, returnA.srId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].sml_txn_type).toBe('SALE_RETURN');
    expect(Number(ledger[0].sml_direction)).toBe(1);
    expect(num(ledger[0].sml_qty)).toBe(4);
    expect(num(ledger[0].sml_cost_rate)).toBe(20);
    expect(num(ledger[0].sml_cost_value)).toBe(80);
    expect(ledger[0].sml_bucket).toBe('SALEABLE');
    const [shadow] = await p.stockShadows(SALE_RETURN, returnA.srId);
    expect(num(shadow.svh_total_value)).toBe(80);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(74);

    // The bill's mirror on an SRt voucher, and the cash going back out.
    const vouchers = await p.vouchers(SALE_RETURN, returnA.srId);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].avh_voucher_type_id).toBe(VCHR.SALE_RETURN);
    expect(vouchers[0].avh_voucher_refno).toBe(returnA.srReturnRefno);
    expect(num(vouchers[0].avh_doc_amount)).toBe(472);
    const legs = await p.legs(vouchers[0].avh_voucher_id);
    expect(
      legs.map((l) => [l.av_dr_cr.trim(), l.av_ledger_id, num(l.av_amount), l.av_role]),
    ).toEqual([
      ['CR', WALK_IN, 472, null],
      ['DR', await p.ledgerOfRole('SALES_RETURN'), 400, 'SALES_RETURN'],
      ['DR', await p.ledgerOfRole('OUTPUT_CGST'), 36, 'OUTPUT_CGST'],
      ['DR', await p.ledgerOfRole('OUTPUT_SGST'), 36, 'OUTPUT_SGST'],
      ['CR', await p.ledgerOfRole('COGS'), 80, 'COGS'],
      ['DR', await p.ledgerOfRole('INVENTORY'), 80, 'INVENTORY'],
      ['CR', TENDER_LEDGER.CASH, 472, null],
      ['DR', WALK_IN, 472, null],
    ]);
    expect(await p.partyNet(WALK_IN, returnA.srId)).toBe(0);

    // A credit note in the register, sign −1, pointing at the invoice.
    const [reg] = await p.register(returnA.srId);
    expect(reg.gdr_doc_type).toBe('CREDIT_NOTE');
    expect(reg.gdr_tran_nature).toBe('SALES_RETURN');
    expect(reg.gdr_doc_sign).toBe(-1);
    expect(num(reg.gdr_bill_value)).toBe(472);
    expect(num(reg.gdr_taxable_value)).toBe(400);

    // The CR row exists and is already settled by the refund — no open credit.
    const [cn] = await p.balanceRows(SALE_RETURN, returnA.srId);
    expect(cn.abl_bill_type.trim()).toBe('SALES_RETURN');
    expect(cn.abl_dr_cr.trim()).toBe('CR');
    expect(num(cn.abl_bill_amount)).toBe(472);
    expect(num(cn.abl_alloc_amount)).toBe(472);
    expect(num(cn.abl_pending_amount)).toBe(0);

    // The return's own tender row, on the CR side.
    const tenders = await p.tenders(SALE_RETURN, returnA.srId);
    expect(tenders).toHaveLength(1);
    expect(tenders[0].td_dr_cr.trim()).toBe('CR');
    expect(num(tenders[0].td_amount)).toBe(472);

    // Stamped on the bill.
    const bill = await p.saleBill(billA.sbId);
    expect(num(bill.sb_returned_amt)).toBe(472);
    expect(bill.sb_return_status).toBe('PARTIAL');
  });

  it('bill A can no longer be cancelled while its return stands: 409 SALES_RETURN_LOCKS_BILL', async () => {
    const res = await post('bills/cancel', { ...billKeys(billA.sbId), reason: 'try' });
    expect(res.status).toBe(409);
    expect(codesOf(res)).toContain('SALES_RETURN_LOCKS_BILL');
  });

  it('GET /sale-returns/bill-lines now shows 4 returned on bill A', async () => {
    const res = await get('sale-returns/bill-lines', {
      sbId: billA.sbId,
      sbAccYear: billA.sbAccYear,
    });
    expect(res.status).toBe(200);
    expect(num(res.body.data[0].returnedQty)).toBe(4);
  });

  // ───────────────────────────────────────────────────────────── B · ADJUST

  it('ADJUST: all of bill B comes back — the ORIGINAL bill is set off first, the rest stays an open credit', async () => {
    const created = explain(
      'return B create',
      await post(
        'sale-returns/create',
        saleReturnBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          bill: { sbId: billB.sbId, refno: billB.sbBillRefno },
          lines: [{ item, qty: 10, rate: 100, sbiId: billB.items[0].sbiId, costRate: 20 }],
          settleMode: 'ADJUST',
          usrRefno: `E2E-SR-${tag}-B`,
          reason: `E2E-SR-${tag} full return, adjust`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    const posted = explain(
      'return B post',
      await post('sale-returns/post', saleReturnKeys(created.body.data.srId)),
      201,
    );
    expect(posted.status).toBe(201);
    returnB = posted.body.data;
    expect(returnB.srStatus).toBe('POSTED');
    // 1,180 returned against a bill owing 680: 680 adjusted, 500 credited.
    expect(num(returnB.srAdjustedAmt)).toBe(680);
    expect(num(returnB.srCreditAmt)).toBe(500);
    expect(num(returnB.srRefundAmt)).toBe(0);
    expect(returnB.srSettleStatus).toBe('PARTIAL');

    // The original bill's outstanding is gone — set off, not paid.
    const [ablB] = await p.balanceRows(SALE_BILL, billB.sbId);
    expect(num(ablB.abl_pending_amount)).toBe(0);
    expect(ablB.abl_status.trim()).toBe('CLOSED');
    const adjustments = await p.adjustments(ablB.abl_id);
    const noteAdjust = adjustments.filter((a) => a.abj_adj_type.trim() === 'NOTE_ADJUST');
    expect(noteAdjust).toHaveLength(1);
    expect(num(noteAdjust[0].abj_amount)).toBe(680);
    const [cn] = await p.balanceRows(SALE_RETURN, returnB.srId);
    expect(noteAdjust[0].abj_against_bill_id).toBe(cn.abl_id);
    expect(returnB.posting.settlement.adjustedBills).toEqual([
      expect.objectContaining({ ablId: ablB.abl_id, amount: 680 }),
    ]);

    // What the bill could not absorb stays open on the credit note.
    expect(cn.abl_dr_cr.trim()).toBe('CR');
    expect(num(cn.abl_bill_amount)).toBe(1180);
    expect(num(cn.abl_pending_amount)).toBe(500);

    // No tender leg on an ADJUST: party credited, sales-return debited, taxes, COGS pair.
    const legs = await p.legs(returnB.srPostedVoucherId);
    expect(legs).toHaveLength(6);
    expect(legs[0].av_dr_cr.trim()).toBe('CR');
    expect(legs[0].av_ledger_id).toBe(LISTED_CUSTOMER);
    expect(num(legs[0].av_amount)).toBe(1180);
    // Bill B debited the party 1,180 and the cash tender credited 500; the
    // return credits 1,180 — the party is now 500 in credit, which is the
    // open credit note.
    const billNet = await p.partyNet(LISTED_CUSTOMER, billB.sbId);
    const returnNet = await p.partyNet(LISTED_CUSTOMER, returnB.srId);
    expect(billNet + returnNet).toBe(-500);

    const bill = await p.saleBill(billB.sbId);
    expect(num(bill.sb_returned_amt)).toBe(1180);
    expect(bill.sb_return_status).toBe('FULL');
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(84);
  });

  it('cancelling return B takes the set-off back: bill B owes 680 again, the credit note is retired', async () => {
    const res = explain(
      'return B cancel',
      await post('sale-returns/cancel', {
        ...saleReturnKeys(returnB.srId),
        reason: `E2E-SR-${tag} return B cancelled`,
      }),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.srStatus).toBe('CANCELLED');
    expect(res.body.data.reversalVoucherRefno).toBeTruthy();

    const [ablB] = await p.balanceRows(SALE_BILL, billB.sbId);
    expect(num(ablB.abl_pending_amount)).toBe(680);
    expect(ablB.abl_status.trim()).toBe('PARTIAL');
    // The set-off row is answered by a reversal row (never deleted): nothing live.
    const rows = await p.adjustments(ablB.abl_id);
    const reversedIds = new Set(rows.map((r) => r.abj_reversal_of_id).filter(Boolean));
    const live = rows.filter(
      (r) =>
        r.abj_adj_type.trim() === 'NOTE_ADJUST' &&
        r.abj_reversal_of_id === null &&
        !reversedIds.has(r.abj_id),
    );
    expect(live).toHaveLength(0);
    expect(rows.some((r) => r.abj_reversal_of_id !== null)).toBe(true);

    expect(await p.balanceRows(SALE_RETURN, returnB.srId)).toHaveLength(0);
    const [original] = await p.vouchers(SALE_RETURN, returnB.srId);
    expect(original.avh_voucher_status.trim()).toBe('CANCELLED');
    const mirror = (await p.voucherById(original.avh_reversal_voucher_id))!;
    expect(mirror.avh_voucher_refno).toBe(res.body.data.reversalVoucherRefno);
    const ledger = await p.stockLedger(SALE_RETURN, returnB.srId);
    expect(ledger).toHaveLength(2);
    expect(ledger[1].sml_is_reversal).toBe(true);
    expect(Number(ledger[1].sml_direction)).toBe(-1);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(74);

    const bill = await p.saleBill(billB.sbId);
    expect(num(bill.sb_returned_amt)).toBe(0);
    expect(bill.sb_return_status).toBeNull();
    expect((await p.saleReturnHeader(returnB.srId)).sr_status).toBe('CANCELLED');
  });

  // ──────────────────────────────────────────────────────────── C · ADVANCE

  it('ADVANCE: 3 of bill C come back and the whole 354 stays an open credit the customer can spend', async () => {
    const created = explain(
      'return C create',
      await post(
        'sale-returns/create',
        saleReturnBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          bill: { sbId: billC.sbId, refno: billC.sbBillRefno },
          lines: [{ item, qty: 3, rate: 100, sbiId: billC.items[0].sbiId, costRate: 20 }],
          settleMode: 'ADVANCE',
          usrRefno: `E2E-SR-${tag}-C`,
          reason: `E2E-SR-${tag} keep as credit`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    const posted = explain(
      'return C post',
      await post('sale-returns/post', saleReturnKeys(created.body.data.srId)),
      201,
    );
    expect(posted.status).toBe(201);
    returnC = posted.body.data;
    expect(returnC.srSettleStatus).toBe('CREDITED');
    expect(num(returnC.srCreditAmt)).toBe(354);
    expect(num(returnC.srRefundAmt)).toBe(0);
    expect(num(returnC.srAdjustedAmt)).toBe(0);

    const [cn] = await p.balanceRows(SALE_RETURN, returnC.srId);
    expect(cn.abl_dr_cr.trim()).toBe('CR');
    expect(num(cn.abl_bill_amount)).toBe(354);
    expect(num(cn.abl_alloc_amount)).toBe(0);
    expect(num(cn.abl_pending_amount)).toBe(354);
    expect(cn.abl_status.trim()).toBe('OPEN');
    // Bill C itself is untouched: still fully paid, nothing adjusted against it.
    const [ablC] = await p.balanceRows(SALE_BILL, billC.sbId);
    expect(num(ablC.abl_pending_amount)).toBe(0);
    expect(await p.adjustments(ablC.abl_id)).toHaveLength(0);
    // No tender leg either.
    expect(await p.legs(returnC.srPostedVoucherId)).toHaveLength(6);
    expect(await p.tenders(SALE_RETURN, returnC.srId)).toHaveLength(0);

    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(77);
    const trail = await p.trail(returnC.srId);
    expect(trail.map((t) => t.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
    expect(trail[1].tsl_src_doc_type.trim()).toBe('SALE_RETURN');
  });

  it('/bills/validate proposes the open credit note for the walk-in customer', async () => {
    const res = await post('bills/validate', {
      ...billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-SR-${tag}-PROPOSE`,
      }),
    });
    expect(res.status).toBe(201);
    const [cn] = await p.balanceRows(SALE_RETURN, returnC.srId);
    const proposed = (res.body.data.proposals.creditNotes as Record<string, any>[]).find(
      (c) => c.ablId === cn.abl_id,
    );
    expect(proposed).toBeDefined();
    expect(num(proposed!.pending)).toBe(354);
  });
});
