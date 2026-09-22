import {
  ACC_YEAR,
  API,
  BEARER,
  GODOWN,
  LISTED_CUSTOMER,
  LISTED_CUSTOMER_NAME,
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
  shutdown,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales/sales-e2e.harness';

/**
 * The sale bill, end to end, against the live database — HANDOVER §4 item 2.
 *
 *   opening stock → /bills/create (DRAFT) → /bills/validate → /bills/post →
 *   /bills/cancel
 *
 * and after each door, the ROWS: the shadow stock voucher and its ledger
 * rows, `acc_voucher_header` AND its legs in `acc_vouchers`, the GST register
 * row, `acc_bill_balance`, `sb_posted_voucher_id`, and the status trail —
 * then every one of them reversed by the cancel.
 *
 * This replaces the create-only spec that used to live here. That spec was
 * written when `/bills/create` accepted `sbStatus: POSTED` and wrote the
 * header alone; it asserted "did NOT write acc_vouchers — the per-ledger split
 * is absent" and read `sb_posted_on`, a column migration 30 dropped. Both
 * were true of the old path and false of the one that ships: `sbStatus` in a
 * create body is ignored, only `/bills/post` posts, and a post that writes no
 * legs is the defect this file exists to catch.
 *
 * Figures: one fresh item opened at 100 pcs @ 20.00. A bill of 10 @ 100.00
 * + 18% GST = 1,180.00, so COGS is exactly 200.00 and the eight legs are
 *
 *   DR party 1180 | CR SALES 1000 | CR OUTPUT_CGST 90 | CR OUTPUT_SGST 90 |
 *   DR COGS 200 | CR INVENTORY 200 | DR cash 1180 | CR party 1180
 *
 * Σ DR = Σ CR = 2,560.00.
 */

const tag = runTag();
const SALE_BILL = 'SALE_BILL';

describe('Sale bill — DRAFT → /validate → /post → /cancel (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  let cashBill: Record<string, any>;
  let creditBill: Record<string, any>;
  let postedVoucherId: string;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/bills/${path}`).set('Authorization', BEARER).send(body);

  beforeAll(async () => {
    h = await bootApp(`e2e-bill-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-BILL-${tag}`);
    await postOpeningStock(h, item, 100, 20, `E2E-BILL-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  // ────────────────────────────────────────────────────────── opening stock

  it('opening stock is on the shelf before any bill: 100 @ 20.00', async () => {
    const bal = await p.balance(item.itemId);
    expect(bal).toBeDefined();
    expect(num(bal!.sbl_on_hand_qty)).toBe(100);
    expect(num(bal!.sbl_available_qty)).toBe(100);
    expect(num(bal!.sbl_avg_cost_rate)).toBe(20);
    expect(num(bal!.sbl_stock_value)).toBe(2000);
    const cost = await p.itemCost(item.itemId);
    expect(num(cost!.sic_avg_cost_rate)).toBe(20);
  });

  // ────────────────────────────────────────────────────────────────── DRAFT

  it('/bills/create makes a DRAFT — nothing in accounts, nothing in stock', async () => {
    const res = explain(
      'create',
      await post(
        'create',
        billBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          lines: [{ item, qty: 10, rate: 100 }],
          usrRefno: `E2E-BILL-${tag}-CASH`,
        }),
      ),
      201,
    );
    expect(res.status).toBe(201);
    cashBill = res.body.data;
    expect(cashBill.sbStatus).toBe('DRAFT');
    expect(cashBill.sbBillRefno).toBeTruthy();
    expect(cashBill.sbPostedVoucherId).toBeNull();
    expect(cashBill.tenders).toHaveLength(1);

    expect(await p.vouchers(SALE_BILL, cashBill.sbId)).toHaveLength(0);
    expect(await p.balanceRows(SALE_BILL, cashBill.sbId)).toHaveLength(0);
    expect(await p.stockShadows(SALE_BILL, cashBill.sbId)).toHaveLength(0);
    expect(await p.register(cashBill.sbId)).toHaveLength(0);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(100);

    const trail = await p.trail(cashBill.sbId);
    expect(trail).toHaveLength(1);
    expect(trail[0].tsl_event.trim()).toBe('CREATED');
    expect(trail[0].tsl_from_status).toBeNull();
    expect(trail[0].tsl_to_status.trim()).toBe('DRAFT');
  });

  it('sbStatus: POSTED in a create body is ignored — the bill stays a DRAFT', async () => {
    const res = await post('create', {
      ...billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        usrRefno: `E2E-BILL-${tag}-CASH`,
      }),
      sbId: cashBill.sbId,
      sbStatus: 'POSTED',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.sbStatus).toBe('DRAFT');
    expect(res.body.data.sbBillRefno).toBe(cashBill.sbBillRefno);
    expect(await p.vouchers(SALE_BILL, cashBill.sbId)).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────── validate

  it('/bills/validate dry-runs the post: ok, no refusals, nothing written', async () => {
    const res = explain(
      'validate',
      await post('validate', {
        ...billBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          lines: [{ item, qty: 10, rate: 100 }],
          usrRefno: `E2E-BILL-${tag}-CASH`,
        }),
        sbId: cashBill.sbId,
      }),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.refusals).toEqual([]);
    // Every warning that survives a clean bill is informational.
    for (const w of res.body.data.warnings ?? []) {
      expect(w.level).toBe('INFO');
    }
    expect(res.body.data.rights.post).toBe(true);
    expect(await p.vouchers(SALE_BILL, cashBill.sbId)).toHaveLength(0);
    expect(await p.stockShadows(SALE_BILL, cashBill.sbId)).toHaveLength(0);
  });

  it('/bills/validate lists a refusal instead of throwing — a bill that does not add up', async () => {
    const res = await post('validate', {
      ...billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        usrRefno: `E2E-BILL-${tag}-CASH`,
      }),
      sbBillAmt: 1200,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.ok).toBe(false);
    const codes = (res.body.data.refusals as { code: string }[]).map((r) => r.code);
    expect(codes).toContain('SALES_AMOUNT_MISMATCH');
  });

  // ─────────────────────────────────────────────────────────────────── post

  it('/bills/post moves the goods: one ledger row OUT at the opening cost', async () => {
    const res = explain('post', await post('post', billKeys(cashBill.sbId)), 201);
    expect(res.status).toBe(201);
    cashBill = res.body.data;
    expect(cashBill.sbStatus).toBe('POSTED');
    expect(cashBill.sbPostedVoucherId).toBeTruthy();
    postedVoucherId = cashBill.sbPostedVoucherId;

    const shadows = await p.stockShadows(SALE_BILL, cashBill.sbId);
    expect(shadows).toHaveLength(1);
    expect(shadows[0].svh_status).toBe('POSTED');
    expect(shadows[0].svh_voucher_type).toBe('ISSUE');
    expect(num(shadows[0].svh_total_qty)).toBe(10);
    // Rolled up from the ledger once the engine priced the line: 10 × 20.
    expect(num(shadows[0].svh_total_value)).toBe(200);
    expect(num(shadows[0].svh_total_value_wot)).toBe(200);

    const ledger = await p.stockLedger(SALE_BILL, cashBill.sbId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].sml_txn_type).toBe('SALE');
    expect(Number(ledger[0].sml_direction)).toBe(-1);
    expect(num(ledger[0].sml_qty)).toBe(10);
    expect(num(ledger[0].sml_signed_base_qty)).toBe(-10);
    expect(num(ledger[0].sml_cost_rate)).toBe(20);
    expect(num(ledger[0].sml_cost_value)).toBe(200);
    expect(ledger[0].sml_is_reversal).toBe(false);
    // The engine labelled the row as the SALE, not as a stock issue.
    expect(ledger[0].sml_src_module).toBe('SALES');
    expect(ledger[0].sml_src_doc_type).toBe('SALE_BILL');
    expect(ledger[0].sml_src_refno).toBe(cashBill.sbBillRefno);
    expect(ledger[0].sml_party_id).toBe(WALK_IN);

    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_out_qty)).toBe(10);
    expect(num(bal!.sbl_on_hand_qty)).toBe(90);
    expect(num(bal!.sbl_stock_value)).toBe(1800);
  });

  it('wrote accounts.acc_voucher_header AND its eight legs, balanced to the paisa', async () => {
    const vouchers = await p.vouchers(SALE_BILL, cashBill.sbId);
    expect(vouchers).toHaveLength(1);
    const v = vouchers[0];
    expect(v.avh_voucher_id).toBe(postedVoucherId);
    expect(v.avh_voucher_status.trim()).toBe('POSTED');
    expect(v.avh_voucher_type_id).toBe(VCHR.BILL);
    // The voucher IS the invoice: the bill's own number.
    expect(v.avh_voucher_refno).toBe(cashBill.sbBillRefno);
    expect(num(v.avh_doc_amount)).toBe(1180);
    expect(v.avh_party_id).toBe(WALK_IN);
    expect(v.avh_posted_on).not.toBeNull();
    // tr_av_refresh_totals derives these from the legs — never written by hand.
    expect(num(v.avh_total_debit)).toBe(2560);
    expect(num(v.avh_total_credit)).toBe(2560);

    const legs = await p.legs(postedVoucherId);
    expect(legs.map((l) => l.av_row_no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const sales = await p.ledgerOfRole('SALES');
    const cgst = await p.ledgerOfRole('OUTPUT_CGST');
    const sgst = await p.ledgerOfRole('OUTPUT_SGST');
    const cogs = await p.ledgerOfRole('COGS');
    const inventory = await p.ledgerOfRole('INVENTORY');
    expect(
      legs.map((l) => [l.av_dr_cr.trim(), l.av_ledger_id, num(l.av_amount), l.av_role]),
    ).toEqual([
      ['DR', WALK_IN, 1180, null],
      ['CR', sales, 1000, 'SALES'],
      ['CR', cgst, 90, 'OUTPUT_CGST'],
      ['CR', sgst, 90, 'OUTPUT_SGST'],
      ['DR', cogs, 200, 'COGS'],
      ['CR', inventory, 200, 'INVENTORY'],
      ['DR', TENDER_LEDGER.CASH, 1180, null],
      ['CR', WALK_IN, 1180, null],
    ]);
    // The customer owes nothing: debited for the bill, credited by the cash.
    expect(await p.partyNet(WALK_IN, cashBill.sbId)).toBe(0);
  });

  it('wrote the GST register row and linked the bill to it', async () => {
    const reg = await p.register(cashBill.sbId);
    expect(reg).toHaveLength(1);
    const r = reg[0];
    expect(r.gdr_doc_type).toBe('INVOICE');
    expect(r.gdr_doc_status).toBe('POSTED');
    expect(r.gdr_tran_nature).toBe('SALE');
    expect(r.gdr_doc_flow).toBe('OUTWARD');
    expect(r.gdr_doc_sign).toBe(1);
    expect(r.gdr_supply_nature).toBe('INTRA_STATE');
    expect(num(r.gdr_taxable_value)).toBe(1000);
    expect(num(r.gdr_cgst_value)).toBe(90);
    expect(num(r.gdr_sgst_value)).toBe(90);
    expect(num(r.gdr_bill_value)).toBe(1180);
    expect(r.gdr_party_id).toBe(WALK_IN);
    expect(r.gdr_voucher_id).toBe(postedVoucherId);
    expect(r.gdr_voucher_type_id).toBe(VCHR.BILL);
    // 1,180 intra-state in TN is far below the e-way bill line.
    expect(r.gdr_is_ewaybill_applicable).toBe(false);

    const bill = await p.saleBill(cashBill.sbId);
    expect(bill.sb_doc_register_id).toBe(r.gdr_id);
    expect(cashBill.sbDocRegisterId).toBe(r.gdr_id);
    // Nothing was declared: the register is open, so the bill can still be cancelled.
    expect(cashBill.locks.irnLive).toBe(false);
    expect(cashBill.locks.ewbLive).toBe(false);
  });

  it('wrote accounts.acc_bill_balance, settled in full by the cash tender', async () => {
    const rows = await p.balanceRows(SALE_BILL, cashBill.sbId);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.abl_bill_type.trim()).toBe('SALES');
    expect(r.abl_dr_cr.trim()).toBe('DR');
    expect(r.abl_party_id).toBe(WALK_IN);
    expect(num(r.abl_bill_amount)).toBe(1180);
    expect(num(r.abl_alloc_amount)).toBe(1180);
    // GENERATED: bill − alloc − disc − writeoff.
    expect(num(r.abl_pending_amount)).toBe(0);
    expect(r.abl_status.trim()).toBe('CLOSED');
    expect(r.abl_voucher_id).toBe(postedVoucherId);
    expect(r.abl_credit_days).toBe(30);
    expect(r.abl_doc_refno).toBe(cashBill.sbBillRefno);
  });

  it('wrote sb_posted_voucher_id, the COGS and the paid figures back onto the bill', async () => {
    const bill = await p.saleBill(cashBill.sbId);
    expect(bill.sb_status).toBe('POSTED');
    expect(bill.sb_posted_voucher_id).toBe(postedVoucherId);
    expect(num(bill.sb_cogs_amt)).toBe(200);
    expect(num(bill.sb_total_cost)).toBe(200);
    expect(num(bill.sb_paid_amt)).toBe(1180);
    expect(num(bill.sb_balance_amt)).toBe(0);
    expect(bill.sb_pay_status).toBe('PAID');
    expect(bill.sb_has_dc).toBe(false);
    expect(bill.sb_revision_no).toBe(1);

    const items = await p.saleBillItems(cashBill.sbId);
    expect(items).toHaveLength(1);
    expect(num(items[0].sbi_cogs_amt)).toBe(200);
    // The engine resolved the lot and stamped it on the bill line.
    expect(items[0].sbi_lot_id).not.toBeNull();
    const ledger = await p.stockLedger(SALE_BILL, cashBill.sbId);
    expect(ledger[0].sml_lot_id).toBe(items[0].sbi_lot_id);

    // And the /get shape says the same.
    expect(num(cashBill.sbCogsAmt)).toBe(200);
    expect(cashBill.sbPayStatus).toBe('PAID');
    expect(cashBill.posting.voucherId).toBe(postedVoucherId);
    expect(cashBill.posting.voucherRefno).toBe(cashBill.sbBillRefno);
    expect(num(cashBill.posting.cogsAmt)).toBe(200);
  });

  it('appended a POSTED step to the status trail', async () => {
    const trail = await p.trail(cashBill.sbId);
    expect(trail).toHaveLength(2);
    expect(trail[1].tsl_seq_no).toBe(2);
    expect(trail[1].tsl_event.trim()).toBe('POSTED');
    expect(trail[1].tsl_from_status.trim()).toBe('DRAFT');
    expect(trail[1].tsl_to_status.trim()).toBe('POSTED');
    expect(trail[1].tsl_src_doc_type.trim()).toBe('SALE_BILL');
  });

  it('/bills/post on a POSTED id is idempotent — same voucher, no second set of rows', async () => {
    const res = await post('post', billKeys(cashBill.sbId));
    expect(res.status).toBe(201);
    expect(res.body.data.sbPostedVoucherId).toBe(postedVoucherId);
    expect(await p.vouchers(SALE_BILL, cashBill.sbId)).toHaveLength(1);
    expect(await p.stockLedger(SALE_BILL, cashBill.sbId)).toHaveLength(1);
    expect(await p.balanceRows(SALE_BILL, cashBill.sbId)).toHaveLength(1);
    expect(await p.trail(cashBill.sbId)).toHaveLength(2);
  });

  it('a POSTED bill refuses /create (409 SALES_BILL_POSTED) and /delete (409)', async () => {
    const edit = await post('create', {
      ...billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        usrRefno: `E2E-BILL-${tag}-CASH`,
      }),
      sbId: cashBill.sbId,
    });
    expect(edit.status).toBe(409);
    expect(codesOf(edit)).toContain('SALES_BILL_POSTED');

    const del = await post('delete', billKeys(cashBill.sbId));
    expect(del.status).toBe(409);
    expect(codesOf(del)).toContain('SALES_BILL_POSTED');
  });

  // ────────────────────────────────────────────────────────── a credit bill

  it('an unpaid CREDIT bill on a listed customer leaves the whole amount outstanding and writes no tender leg', async () => {
    const created = explain(
      'create credit',
      await post(
        'create',
        billBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 10, rate: 100 }],
          tenders: [],
          usrRefno: `E2E-BILL-${tag}-CREDIT`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    const posted = explain(
      'post credit',
      await post('post', billKeys(created.body.data.sbId)),
      201,
    );
    expect(posted.status).toBe(201);
    creditBill = posted.body.data;
    expect(creditBill.sbStatus).toBe('POSTED');
    expect(creditBill.sbPayStatus).toBe('UNPAID');

    const [abl] = await p.balanceRows(SALE_BILL, creditBill.sbId);
    expect(num(abl.abl_bill_amount)).toBe(1180);
    expect(num(abl.abl_alloc_amount)).toBe(0);
    expect(num(abl.abl_pending_amount)).toBe(1180);
    expect(abl.abl_status.trim()).toBe('OPEN');

    // Party, sales, two taxes, the COGS pair — and NOTHING settling the party.
    const legs = await p.legs(creditBill.sbPostedVoucherId);
    expect(legs).toHaveLength(6);
    expect(legs.filter((l) => l.av_ledger_id === LISTED_CUSTOMER)).toHaveLength(1);
    expect(await p.partyNet(LISTED_CUSTOMER, creditBill.sbId)).toBe(1180);

    // Second sale off the same holding: 90 − 10, still at the opening cost.
    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_on_hand_qty)).toBe(80);
    expect(num(bal!.sbl_stock_value)).toBe(1600);
  });

  // ───────────────────────────────────────────────────────────────── cancel

  it('/bills/cancel reverses the voucher: original CANCELLED, a POSTED mirror with every leg flipped', async () => {
    const res = explain(
      'cancel',
      await post('cancel', { ...billKeys(cashBill.sbId), reason: `E2E-BILL-${tag} cancel` }),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.sbStatus).toBe('CANCELLED');
    expect(res.body.data.reversalVoucherRefno).toBeTruthy();
    expect(res.body.data.cancelledOn).toBeTruthy();

    // The document still owns ONE voucher — the original, now CANCELLED. The
    // mirror answers it through avh_against_voucher_id and carries no source
    // pointer of its own (ux_avh_src admits one live voucher per document).
    const vouchers = await p.vouchers(SALE_BILL, cashBill.sbId);
    expect(vouchers).toHaveLength(1);
    const original = vouchers[0];
    expect(original.avh_voucher_id).toBe(postedVoucherId);
    expect(original.avh_voucher_status.trim()).toBe('CANCELLED');
    expect(original.avh_cancel_reason).toBe(`E2E-BILL-${tag} cancel`);
    expect(original.avh_reversal_voucher_id).toBeTruthy();
    // The original keeps its number: bil00042 stays bil00042.
    expect(original.avh_voucher_refno).toBe(cashBill.sbBillRefno);

    const mirror = (await p.voucherById(original.avh_reversal_voucher_id))!;
    expect(mirror.avh_voucher_status.trim()).toBe('POSTED');
    expect(mirror.avh_against_voucher_id).toBe(postedVoucherId);
    expect(mirror.avh_voucher_type_id).toBe(VCHR.BILL);
    expect(mirror.avh_voucher_refno).toBe(res.body.data.reversalVoucherRefno);
    // A number of its own — ux_avh_voucher_no keeps a cancelled number taken.
    expect(mirror.avh_voucher_refno).not.toBe(original.avh_voucher_refno);
    expect(mirror.avh_src_doc_id).toBeNull();
    expect(mirror.avh_doc_refno).toBeNull();
    expect(mirror.avh_remarks).toContain(cashBill.sbBillRefno);
    // Dated the original, not today.
    expect(String(mirror.avh_voucher_date)).toBe(String(original.avh_voucher_date));
    expect(num(mirror.avh_total_debit)).toBe(2560);
    expect(num(mirror.avh_total_credit)).toBe(2560);

    const before = await p.legs(postedVoucherId);
    const after = await p.legs(mirror.avh_voucher_id);
    expect(after).toHaveLength(8);
    expect(
      after.map((l) => [l.av_row_no, l.av_dr_cr.trim(), l.av_ledger_id, num(l.av_amount)]),
    ).toEqual(
      before.map((l) => [
        l.av_row_no,
        l.av_dr_cr.trim() === 'DR' ? 'CR' : 'DR',
        l.av_ledger_id,
        num(l.av_amount),
      ]),
    );
    // The two together net every ledger to zero.
    expect(await p.partyNet(WALK_IN, cashBill.sbId)).toBe(0);
  });

  it('/bills/cancel brings the goods back: a reversal row IN at the cost they left at', async () => {
    const ledger = await p.stockLedger(SALE_BILL, cashBill.sbId);
    expect(ledger).toHaveLength(2);
    const [out, back] = ledger;
    expect(back.sml_is_reversal).toBe(true);
    expect(Number(back.sml_direction)).toBe(1);
    expect(num(back.sml_qty)).toBe(10);
    expect(num(back.sml_signed_base_qty)).toBe(10);
    expect(num(back.sml_cost_rate)).toBe(num(out.sml_cost_rate));
    expect(num(back.sml_cost_value)).toBe(200);
    expect(back.sml_lot_id).toBe(out.sml_lot_id);

    const shadows = await p.stockShadows(SALE_BILL, cashBill.sbId);
    expect(shadows[0].svh_status).toBe('CANCELLED');

    // 100 opened − 10 (credit bill, still posted) = 90; the cash bill's 10 are back.
    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_on_hand_qty)).toBe(90);
    expect(num(bal!.sbl_avg_cost_rate)).toBe(20);
    expect(num(bal!.sbl_stock_value)).toBe(1800);
  });

  it('/bills/cancel retires the register row, the receivable and the bill, and logs why', async () => {
    const [reg] = await p.register(cashBill.sbId);
    expect(reg.gdr_doc_status).toBe('CANCELED');
    expect(reg.gdr_doc_cancel_reason).toBe(`E2E-BILL-${tag} cancel`);

    expect(await p.balanceRows(SALE_BILL, cashBill.sbId)).toHaveLength(0);

    const bill = await p.saleBill(cashBill.sbId);
    expect(bill.sb_status).toBe('CANCELLED');
    // The header keeps its posting pointer — the voucher stays on record, CANCELLED.
    expect(bill.sb_posted_voucher_id).toBe(postedVoucherId);

    const trail = await p.trail(cashBill.sbId);
    expect(trail).toHaveLength(3);
    expect(trail[2].tsl_event.trim()).toBe('CANCELLED');
    expect(trail[2].tsl_from_status.trim()).toBe('POSTED');
    expect(trail[2].tsl_to_status.trim()).toBe('CANCELLED');
    expect(trail[2].tsl_remarks).toBe(`E2E-BILL-${tag} cancel`);
  });

  it('cancel is idempotent; post, create and delete on a CANCELLED bill are refused', async () => {
    const again = await post('cancel', { ...billKeys(cashBill.sbId), reason: 'again' });
    expect(again.status).toBe(201);
    expect(again.body.data.sbStatus).toBe('CANCELLED');
    // No second mirror, no second reversal row.
    const [original] = await p.vouchers(SALE_BILL, cashBill.sbId);
    expect(original.avh_cancel_reason).toBe(`E2E-BILL-${tag} cancel`);
    expect(await p.stockLedger(SALE_BILL, cashBill.sbId)).toHaveLength(2);

    const rePost = await post('post', billKeys(cashBill.sbId));
    expect(rePost.status).toBe(409);
    expect(codesOf(rePost)).toContain('SALES_BILL_CANCELLED');

    const del = await post('delete', billKeys(cashBill.sbId));
    expect(del.status).toBe(409);
    expect(codesOf(del)).toContain('SALES_BILL_CANCELLED');
  });

  it('a DRAFT is not cancelled but deleted — and the delete leaves no live rows', async () => {
    const created = await post(
      'create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-BILL-${tag}-DRAFT`,
      }),
    );
    expect(created.status).toBe(201);
    const sbId = created.body.data.sbId as string;

    const cancel = await post('cancel', { ...billKeys(sbId), reason: 'a draft' });
    expect(cancel.status).toBe(409);
    expect(codesOf(cancel)).toContain('SALES_DOC_NOT_DRAFT');

    const del = await post('delete', billKeys(sbId));
    expect(del.status).toBe(201);
    expect(del.body.data).toEqual({ sbId, deleted: true });
    const [row] = await h.prisma.$queryRawUnsafe<{ sb_is_deleted: boolean }[]>(
      `SELECT sb_is_deleted FROM sales.sale_bill WHERE sb_id = $1::uuid AND sb_acc_year = $2`,
      sbId,
      ACC_YEAR,
    );
    expect(row.sb_is_deleted).toBe(true);
    expect(await p.tenders(SALE_BILL, sbId)).toHaveLength(0);
  });

  it('cancelling the credit bill too returns the holding to exactly the opening', async () => {
    const res = await post('cancel', {
      ...billKeys(creditBill.sbId),
      reason: `E2E-BILL-${tag} cancel credit`,
    });
    expect(res.status).toBe(201);
    expect(await p.balanceRows(SALE_BILL, creditBill.sbId)).toHaveLength(0);
    expect(await p.partyNet(LISTED_CUSTOMER, creditBill.sbId)).toBe(0);

    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_in_qty)).toBe(120); // 100 opened + 10 + 10 reversed
    expect(num(bal!.sbl_out_qty)).toBe(20);
    expect(num(bal!.sbl_on_hand_qty)).toBe(100);
    expect(num(bal!.sbl_stock_value)).toBe(2000);
    expect(bal!.sbl_bucket).toBe('SALEABLE');
    expect(GODOWN).toBeTruthy();
  });
});
