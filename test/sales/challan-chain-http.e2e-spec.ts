import {
  API,
  BEARER,
  LISTED_CUSTOMER,
  LISTED_CUSTOMER_NAME,
  TENDER_LEDGER,
  VCHR,
  billBody,
  billKeys,
  bootApp,
  codesOf,
  dcBody,
  dcKeys,
  dcReturnBody,
  dcReturnKeys,
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
} from './sales-e2e.harness';

/**
 * The challan chain, end to end, against the live database — HANDOVER §4
 * items 3 and 4.
 *
 *   opening stock 50 @ 30 → challan 20 (goods leave, COGS 600 on a DCh voucher)
 *   → bill 12 against the challan (NO stock, NO COGS, the DC's open qty drops)
 *   → DC return of the other 8 (goods back at the cost they LEFT at, a DCR
 *     voucher with the COGS pair reversed and NO party leg, a CHALLAN register
 *     row and NO e-invoice) → cancel the return → the open qty is back.
 *
 * The bill against the challan is the point of the chain: the cost left the
 * shelf at the challan, so the bill's `sbi_cogs_amt` is 0 and its voucher has
 * no COGS pair, while the party is still debited for the whole invoice.
 */

const tag = runTag();
const DC = 'DELIVERY_CHALLAN';
const DCR = 'DC_RETURN';
const SALE_BILL = 'SALE_BILL';

describe('Challan → bill against it → DC return (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  let dc: Record<string, any>;
  let dcLine: Record<string, any>;
  let bill: Record<string, any>;
  let dcReturn: Record<string, any>;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);
  const get = (path: string, query: Record<string, string>) =>
    h.http.get(`${API}/${path}`).set('Authorization', BEARER).query(query);

  beforeAll(async () => {
    h = await bootApp(`e2e-dc-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-DC-${tag}`);
    await postOpeningStock(h, item, 50, 30, `E2E-DC-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  // ──────────────────────────────────────────────────────────────── challan

  it('/delivery-challans/create makes a DRAFT with its own number and no stock effect', async () => {
    const res = explain(
      'dc create',
      await post(
        'delivery-challans/create',
        dcBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 20, rate: 100 }],
          usrRefno: `E2E-DC-${tag}`,
        }),
      ),
      201,
    );
    expect(res.status).toBe(201);
    dc = res.body.data;
    expect(dc.sdcStatus).toBe('DRAFT');
    expect(dc.sdcDcRefno).toBeTruthy();
    expect(dc.sdcPurpose).toBe('SUPPLY');
    expect(dc.items).toHaveLength(1);
    dcLine = dc.items[0];
    expect(num(dcLine.sdiDcQty)).toBe(20);
    expect(await p.stockShadows(DC, dc.sdcId)).toHaveLength(0);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(50);
  });

  it('/delivery-challans/validate answers ok for the draft', async () => {
    const res = explain(
      'dc validate',
      await post('delivery-challans/validate', {
        ...dcBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 20, rate: 100 }],
          usrRefno: `E2E-DC-${tag}`,
        }),
        sdcId: dc.sdcId,
      }),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.refusals).toEqual([]);
  });

  it('/delivery-challans/post moves 20 out at 30.00 and posts the COGS pair on a DCh voucher', async () => {
    const res = explain('dc post', await post('delivery-challans/post', dcKeys(dc.sdcId)), 201);
    expect(res.status).toBe(201);
    dc = res.body.data;
    expect(dc.sdcStatus).toBe('POSTED');
    expect(dc.sdcPostedVoucherId).toBeTruthy();
    expect(num(dc.sdcTotalCost)).toBe(600);

    const ledger = await p.stockLedger(DC, dc.sdcId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].sml_txn_type).toBe('DC_ISSUE');
    expect(Number(ledger[0].sml_direction)).toBe(-1);
    expect(num(ledger[0].sml_qty)).toBe(20);
    expect(num(ledger[0].sml_cost_rate)).toBe(30);
    expect(num(ledger[0].sml_cost_value)).toBe(600);
    expect(ledger[0].sml_src_doc_type).toBe(DC);
    expect(ledger[0].sml_party_id).toBe(LISTED_CUSTOMER);

    const [shadow] = await p.stockShadows(DC, dc.sdcId);
    expect(num(shadow.svh_total_qty)).toBe(20);
    expect(num(shadow.svh_total_value)).toBe(600);

    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_on_hand_qty)).toBe(30);
    expect(num(bal!.sbl_stock_value)).toBe(900);

    // DR COGS 600 / CR INVENTORY 600 — and nothing else: a challan raises no debt.
    const vouchers = await p.vouchers(DC, dc.sdcId);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].avh_voucher_type_id).toBe(VCHR.DELIVERY_CHALLAN);
    expect(vouchers[0].avh_voucher_refno).toBe(dc.sdcDcRefno);
    expect(num(vouchers[0].avh_total_debit)).toBe(600);
    expect(num(vouchers[0].avh_total_credit)).toBe(600);
    const legs = await p.legs(vouchers[0].avh_voucher_id);
    expect(legs.map((l) => [l.av_dr_cr.trim(), l.av_role, num(l.av_amount)])).toEqual([
      ['DR', 'COGS', 600],
      ['CR', 'INVENTORY', 600],
    ]);
    expect(legs.some((l) => l.av_ledger_id === LISTED_CUSTOMER)).toBe(false);
    expect(await p.balanceRows(DC, dc.sdcId)).toHaveLength(0);

    // The register: a challan for the e-way bill, never an IRN.
    const [reg] = await p.register(dc.sdcId);
    expect(reg.gdr_doc_type).toBe('DELIVERY_CHALLAN');
    expect(reg.gdr_tran_nature).toBe('DELIVERY_CHALLAN');
    expect(reg.gdr_doc_status).toBe('POSTED');
    expect(reg.gdr_is_einvoice_applicable).toBe(false);
    expect(num(reg.gdr_bill_value)).toBe(2360);

    // The line carries the cost it left at and is fully open.
    const [line] = await p.dcItems(dc.sdcId);
    expect(num(line.sdi_cost_price)).toBe(600);
    expect(line.sdi_lot_id).toBe(ledger[0].sml_lot_id);
    expect(num(line.sdi_billed_qty)).toBe(0);
    expect(num(line.sdi_returned_qty)).toBe(0);
    expect(num(line.sdi_open_qty)).toBe(20);
    expect(line.sdi_line_status).toBe('OPEN');
    const header = await p.dcHeader(dc.sdcId);
    expect(header.sdc_fulfil_status).toBe('OPEN');

    const trail = await p.trail(dc.sdcId);
    expect(trail.map((t) => t.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
    expect(trail[1].tsl_src_doc_type.trim()).toBe('DELIVERY_CHALLAN');
  });

  it('GET /bills/open-sources lists the challan line with 20 open', async () => {
    const res = await get('bills/open-sources', {
      companyId: dc.sdcCompanyId,
      branchId: dc.sdcBranchId,
      partyId: LISTED_CUSTOMER,
      kind: 'DC',
    });
    expect(res.status).toBe(200);
    const json = JSON.stringify(res.body.data);
    expect(json).toContain(dcLine.sdiId);
    expect(json).toContain(dc.sdcDcRefno);
  });

  // ────────────────────────────────────────────────────── bill against it

  it('a bill for 12 of the 20 posts with NO stock movement and NO COGS — the cost left at the challan', async () => {
    const created = explain(
      'bill create',
      await post(
        'bills/create',
        billBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [
            {
              item,
              qty: 12,
              rate: 100,
              src: { sdcId: dc.sdcId, sdiId: dcLine.sdiId, refno: dc.sdcDcRefno, lineNo: 1 },
            },
          ],
          usrRefno: `E2E-DC-${tag}-BILL`,
          extra: { sbSrcDocType: DC, sbSrcDocId: dc.sdcId, sbSrcDocYear: dc.sdcAccYear },
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    const posted = explain(
      'bill post',
      await post('bills/post', billKeys(created.body.data.sbId)),
      201,
    );
    expect(posted.status).toBe(201);
    bill = posted.body.data;
    expect(bill.sbStatus).toBe('POSTED');
    expect(bill.sbHasDc).toBe(true);
    expect(num(bill.sbCogsAmt)).toBe(0);

    // No shadow voucher, no ledger row, the shelf untouched.
    expect(await p.stockShadows(SALE_BILL, bill.sbId)).toHaveLength(0);
    expect(await p.stockLedger(SALE_BILL, bill.sbId)).toHaveLength(0);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(30);

    const [line] = await p.saleBillItems(bill.sbId);
    expect(num(line.sbi_cogs_amt)).toBe(0);
    expect(line.sbi_src_doc_type).toBe(DC);
    expect(line.sbi_src_item_id).toBe(dcLine.sdiId);
    const row = await p.saleBill(bill.sbId);
    expect(num(row.sb_cogs_amt)).toBe(0);
    expect(num(row.sb_total_cost)).toBe(0);

    // 12 × 100 + 18% = 1,416: party, sales, two taxes, the cash pair. No COGS pair.
    const legs = await p.legs(bill.sbPostedVoucherId);
    expect(
      legs.map((l) => [l.av_dr_cr.trim(), l.av_ledger_id, num(l.av_amount), l.av_role]),
    ).toEqual([
      ['DR', LISTED_CUSTOMER, 1416, null],
      ['CR', await p.ledgerOfRole('SALES'), 1200, 'SALES'],
      ['CR', await p.ledgerOfRole('OUTPUT_CGST'), 108, 'OUTPUT_CGST'],
      ['CR', await p.ledgerOfRole('OUTPUT_SGST'), 108, 'OUTPUT_SGST'],
      ['DR', TENDER_LEDGER.CASH, 1416, null],
      ['CR', LISTED_CUSTOMER, 1416, null],
    ]);
    expect(legs.some((l) => l.av_role === 'COGS' || l.av_role === 'INVENTORY')).toBe(false);
  });

  it("the challan's open quantity came down: 20 − 12 billed = 8 open, PARTIAL", async () => {
    const [line] = await p.dcItems(dc.sdcId);
    expect(num(line.sdi_billed_qty)).toBe(12);
    expect(num(line.sdi_returned_qty)).toBe(0);
    expect(num(line.sdi_open_qty)).toBe(8);
    expect(line.sdi_line_status).toBe('PARTIAL');
    const header = await p.dcHeader(dc.sdcId);
    expect(header.sdc_fulfil_status).toBe('PARTIAL');
    expect(num(header.sdc_billed_amt)).toBe(1200);
  });

  it('a second bill for more than the 8 left is refused: 422 SALES_DC_LINE_OVER', async () => {
    const created = await post(
      'bills/create',
      billBody({
        custId: LISTED_CUSTOMER,
        custName: LISTED_CUSTOMER_NAME,
        lines: [
          {
            item,
            qty: 9,
            rate: 100,
            src: { sdcId: dc.sdcId, sdiId: dcLine.sdiId, refno: dc.sdcDcRefno, lineNo: 1 },
          },
        ],
        usrRefno: `E2E-DC-${tag}-OVER`,
      }),
    );
    expect(created.status).toBe(201);
    const res = await post('bills/post', billKeys(created.body.data.sbId));
    expect(res.status).toBe(422);
    expect(codesOf(res)).toContain('SALES_DC_LINE_OVER');
    // Still a draft, nothing moved.
    expect(await p.vouchers(SALE_BILL, created.body.data.sbId)).toHaveLength(0);
    await post('bills/delete', billKeys(created.body.data.sbId));
  });

  it('the challan cannot be cancelled while a bill stands against it: 409 SALES_DC_BILLED', async () => {
    const res = await post('delivery-challans/cancel', { ...dcKeys(dc.sdcId), reason: 'try' });
    expect(res.status).toBe(409);
    expect(codesOf(res)).toContain('SALES_DC_BILLED');
    expect((await p.dcHeader(dc.sdcId)).sdc_status).toBe('POSTED');
  });

  // ─────────────────────────────────────────────────────────────── DC return

  it('GET /dc-returns/open-lines shows the 8 open on the challan line', async () => {
    const res = await get('dc-returns/open-lines', { sdcId: dc.sdcId, sdcAccYear: dc.sdcAccYear });
    expect(res.status).toBe(200);
    const line = (res.body.data as Record<string, any>[]).find((l) => l.dcItemId === dcLine.sdiId);
    expect(line).toBeDefined();
    expect(num(line!.openQty)).toBe(8);
    expect(num(line!.billedQty)).toBe(12);
  });

  it('a DC return of 9 is refused at post: 422 SALES_DCR_OVER_OPEN', async () => {
    const created = await post(
      'dc-returns/create',
      dcReturnBody({
        sdcId: dc.sdcId,
        lines: [{ item, qty: 9, rate: 100, sdiId: dcLine.sdiId, costRate: 30 }],
        usrRefno: `E2E-DC-${tag}-DCR-OVER`,
        reason: 'too many',
      }),
    );
    expect(created.status).toBe(201);
    const res = await post('dc-returns/post', dcReturnKeys(created.body.data.sdrId));
    expect(res.status).toBe(422);
    expect(codesOf(res)).toContain('SALES_DCR_OVER_OPEN');
    await post('dc-returns/delete', dcReturnKeys(created.body.data.sdrId));
  });

  it('a DC return of the 8 brings the lot and the cost back at what they LEFT at', async () => {
    const created = explain(
      'dcr create',
      await post(
        'dc-returns/create',
        dcReturnBody({
          sdcId: dc.sdcId,
          lines: [{ item, qty: 8, rate: 100, sdiId: dcLine.sdiId, costRate: 30 }],
          usrRefno: `E2E-DC-${tag}-DCR`,
          reason: `E2E-DC-${tag} goods back`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    expect(created.body.data.sdrStatus).toBe('DRAFT');
    // The challan's identity was copied onto the return from the master row.
    expect(created.body.data.sdrDcRefno).toBe(dc.sdcDcRefno);
    expect(created.body.data.sdrCustId).toBe(LISTED_CUSTOMER);

    const posted = explain(
      'dcr post',
      await post('dc-returns/post', dcReturnKeys(created.body.data.sdrId)),
      201,
    );
    expect(posted.status).toBe(201);
    dcReturn = posted.body.data;
    expect(dcReturn.sdrStatus).toBe('POSTED');
    expect(num(dcReturn.sdrTotalCost)).toBe(240);

    const ledger = await p.stockLedger(DCR, dcReturn.sdrId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].sml_txn_type).toBe('DC_RETURN');
    expect(Number(ledger[0].sml_direction)).toBe(1);
    expect(num(ledger[0].sml_qty)).toBe(8);
    expect(num(ledger[0].sml_cost_rate)).toBe(30);
    expect(num(ledger[0].sml_cost_value)).toBe(240);
    expect(ledger[0].sml_bucket).toBe('SALEABLE');
    // Same lot the challan drew on.
    const [dcLedger] = await p.stockLedger(DC, dc.sdcId);
    expect(ledger[0].sml_lot_id).toBe(dcLedger.sml_lot_id);

    const [shadow] = await p.stockShadows(DCR, dcReturn.sdrId);
    expect(num(shadow.svh_total_value)).toBe(240);

    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_on_hand_qty)).toBe(38);
    expect(num(bal!.sbl_avg_cost_rate)).toBe(30);
    expect(num(bal!.sbl_stock_value)).toBe(1140);
  });

  it('the DCR voucher is the COGS pair reversed — and carries NO party leg', async () => {
    const vouchers = await p.vouchers(DCR, dcReturn.sdrId);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].avh_voucher_id).toBe(dcReturn.sdrPostedVoucherId);
    expect(vouchers[0].avh_voucher_type_id).toBe(VCHR.DC_RETURN);
    expect(vouchers[0].avh_voucher_refno).toBe(dcReturn.sdrReturnRefno);
    const legs = await p.legs(vouchers[0].avh_voucher_id);
    expect(legs.map((l) => [l.av_dr_cr.trim(), l.av_role, num(l.av_amount)])).toEqual([
      ['CR', 'COGS', 240],
      ['DR', 'INVENTORY', 240],
    ]);
    expect(legs.some((l) => l.av_ledger_id === LISTED_CUSTOMER)).toBe(false);
    expect(await p.partyNet(LISTED_CUSTOMER, dcReturn.sdrId)).toBe(0);
    // No money moved, so no receivable and no credit.
    expect(await p.balanceRows(DCR, dcReturn.sdrId)).toHaveLength(0);
  });

  it('the DCR register row is a CHALLAN, inward, sign −1, with no IRN', async () => {
    const reg = await p.register(dcReturn.sdrId);
    expect(reg).toHaveLength(1);
    expect(reg[0].gdr_doc_type).toBe('CHALLAN');
    expect(reg[0].gdr_tran_nature).toBe('DELIVERY_CHALLAN');
    expect(reg[0].gdr_doc_flow).toBe('INWARD');
    expect(reg[0].gdr_doc_sign).toBe(-1);
    expect(reg[0].gdr_doc_status).toBe('POSTED');
    expect(reg[0].gdr_is_einvoice_applicable).toBe(false);
    expect(await p.einvoiceRows(reg[0].gdr_id)).toHaveLength(0);
    expect(num(reg[0].gdr_bill_value)).toBe(944);
  });

  it('the challan line is now CLOSED: 12 billed + 8 returned = 20', async () => {
    const [line] = await p.dcItems(dc.sdcId);
    expect(num(line.sdi_billed_qty)).toBe(12);
    expect(num(line.sdi_returned_qty)).toBe(8);
    expect(num(line.sdi_open_qty)).toBe(0);
    expect(line.sdi_line_status).toBe('CLOSED');
    const header = await p.dcHeader(dc.sdcId);
    expect(header.sdc_fulfil_status).toBe('CLOSED');
    expect(num(header.sdc_returned_amt)).toBe(800);

    const trail = await p.trail(dcReturn.sdrId);
    expect(trail.map((t) => t.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
  });

  it('cancelling the DC return reverses the goods and re-opens the 8', async () => {
    const res = explain(
      'dcr cancel',
      await post('dc-returns/cancel', {
        ...dcReturnKeys(dcReturn.sdrId),
        reason: `E2E-DC-${tag} return cancelled`,
      }),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.sdrStatus).toBe('CANCELLED');
    expect(res.body.data.reversalVoucherRefno).toBeTruthy();

    const ledger = await p.stockLedger(DCR, dcReturn.sdrId);
    expect(ledger).toHaveLength(2);
    expect(ledger[1].sml_is_reversal).toBe(true);
    expect(Number(ledger[1].sml_direction)).toBe(-1);
    expect(num(ledger[1].sml_qty)).toBe(8);
    expect(num(ledger[1].sml_cost_rate)).toBe(30);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(30);

    const [original] = await p.vouchers(DCR, dcReturn.sdrId);
    expect(original.avh_voucher_status.trim()).toBe('CANCELLED');
    const mirror = (await p.voucherById(original.avh_reversal_voucher_id))!;
    expect(mirror.avh_against_voucher_id).toBe(original.avh_voucher_id);
    expect(mirror.avh_voucher_refno).toBe(res.body.data.reversalVoucherRefno);
    expect(
      (await p.legs(mirror.avh_voucher_id)).map((l) => [l.av_dr_cr.trim(), l.av_role]),
    ).toEqual([
      ['DR', 'COGS'],
      ['CR', 'INVENTORY'],
    ]);
    const [reg] = await p.register(dcReturn.sdrId);
    expect(reg.gdr_doc_status).toBe('CANCELED');

    const [line] = await p.dcItems(dc.sdcId);
    expect(num(line.sdi_returned_qty)).toBe(0);
    expect(num(line.sdi_open_qty)).toBe(8);
    expect(line.sdi_line_status).toBe('PARTIAL');
    expect((await p.dcHeader(dc.sdcId)).sdc_fulfil_status).toBe('PARTIAL');
    expect((await p.dcReturnHeader(dcReturn.sdrId)).sdr_status).toBe('CANCELLED');
  });

  it('cancelling the bill hands its 12 back to the challan; then the challan itself can be cancelled', async () => {
    const cancelBill = explain(
      'bill cancel',
      await post('bills/cancel', {
        ...billKeys(bill.sbId),
        reason: `E2E-DC-${tag} bill cancelled`,
      }),
      201,
    );
    expect(cancelBill.status).toBe(201);
    const [line] = await p.dcItems(dc.sdcId);
    expect(num(line.sdi_billed_qty)).toBe(0);
    expect(num(line.sdi_open_qty)).toBe(20);
    expect(line.sdi_line_status).toBe('OPEN');
    // A bill that moved no stock reverses no stock.
    expect(await p.stockLedger(SALE_BILL, bill.sbId)).toHaveLength(0);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(30);

    const cancelDc = explain(
      'dc cancel',
      await post('delivery-challans/cancel', {
        ...dcKeys(dc.sdcId),
        reason: `E2E-DC-${tag} challan cancelled`,
      }),
      201,
    );
    expect(cancelDc.status).toBe(201);
    expect(cancelDc.body.data.sdcStatus).toBe('CANCELLED');
    const ledger = await p.stockLedger(DC, dc.sdcId);
    expect(ledger).toHaveLength(2);
    expect(ledger[1].sml_is_reversal).toBe(true);
    expect(num(ledger[1].sml_cost_rate)).toBe(30);
    const bal = await p.balance(item.itemId);
    expect(num(bal!.sbl_on_hand_qty)).toBe(50);
    expect(num(bal!.sbl_stock_value)).toBe(1500);
    const [original] = await p.vouchers(DC, dc.sdcId);
    expect(original.avh_voucher_status.trim()).toBe('CANCELLED');
    expect(original.avh_reversal_voucher_id).toBeTruthy();
    expect((await p.voucherById(original.avh_reversal_voucher_id))!.avh_voucher_status.trim()).toBe(
      'POSTED',
    );
  });
});
