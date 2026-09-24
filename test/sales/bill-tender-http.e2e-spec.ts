import {
  ACC_YEAR,
  API,
  BEARER,
  COMPANY,
  TENDER,
  TENDER_LEDGER,
  VCHR,
  WALK_IN,
  WALK_IN_NAME,
  addDays,
  billBody,
  billKeys,
  bootApp,
  codesOf,
  explain,
  grantSalesRights,
  isoDay,
  makeItem,
  num,
  postOpeningStock,
  probes,
  revokeSalesRights,
  runTag,
  shutdown,
  today,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales-e2e.harness';

/**
 * How a bill was paid, end to end — HANDOVER §4 item 6 and §7 (31):
 *
 *   a walk-in bill of 1,180 tendered 680 cash + 500 TEMP_CR
 *     → /bills/post writes an acc_temp_credit row (the WHO behind the 500)
 *       and NO leg for the temporary credit: the party's debit IS the debt
 *     → GET /temp-credits/open lists it, PUT /temp-credits/follow-up notes it
 *     → /bills/retender voids the cash and re-tenders it as UPI: a TndC
 *       contra DR UPI / CR cash, and the PARTY BALANCE NEVER MOVES
 *     → /bills/cancel retires the temporary credit with the bill.
 */

const tag = runTag();
const SALE_BILL = 'SALE_BILL';
const MOBILE = `9${String(Date.now()).slice(-9)}`;

describe('Temporary credit and re-tender (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  let bill: Record<string, any>;
  let cashTender: Record<string, any>;
  let atcId: string;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);
  const put = (path: string, body: Record<string, unknown>) =>
    h.http.put(`${API}/${path}`).set('Authorization', BEARER).send(body);
  const get = (path: string, query: Record<string, string>) =>
    h.http.get(`${API}/${path}`).set('Authorization', BEARER).query(query);

  beforeAll(async () => {
    h = await bootApp(`e2e-tender-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-TENDER-${tag}`);
    await postOpeningStock(h, item, 20, 20, `E2E-TENDER-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  it('a walk-in owing 500 needs a TEMP_CR tender with a name and mobile: 422 without one', async () => {
    const created = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 10, rate: 100 }],
        tenders: [{ tenderId: TENDER.CASH, amount: 680 }],
        usrRefno: `E2E-TENDER-${tag}-NO-TC`,
      }),
    );
    expect(created.status).toBe(201);
    const res = await post('bills/post', billKeys(created.body.data.sbId));
    expect(res.status).toBe(422);
    expect(codesOf(res)).toContain('SALES_TEMP_CREDIT_DETAILS_MISSING');
    await post('bills/delete', billKeys(created.body.data.sbId));
  });

  it('/bills/post with 680 cash + 500 TEMP_CR writes the temporary credit and no leg for it', async () => {
    const created = explain(
      'create',
      await post(
        'bills/create',
        billBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          lines: [{ item, qty: 10, rate: 100 }],
          tenders: [
            { tenderId: TENDER.CASH, amount: 680 },
            {
              tenderId: TENDER.TEMP_CR,
              amount: 500,
              tempCredit: { name: 'Ravi (e2e)', mobile: MOBILE, days: 10, place: 'Peelamedu' },
            },
          ],
          usrRefno: `E2E-TENDER-${tag}`,
        }),
      ),
      201,
    );
    expect(created.status).toBe(201);
    // The WHO rides on the DRAFT's tender row until the post.
    const draftTc = created.body.data.tenders.find(
      (t: Record<string, any>) => Number(t.tdTenderTypeId) === 8,
    );
    expect(draftTc.tempCredit).toEqual(
      expect.objectContaining({ name: 'Ravi (e2e)', mobile: MOBILE, days: 10 }),
    );

    const posted = explain('post', await post('bills/post', billKeys(created.body.data.sbId)), 201);
    expect(posted.status).toBe(201);
    bill = posted.body.data;
    expect(bill.sbStatus).toBe('POSTED');
    expect(bill.sbPayStatus).toBe('PARTIAL');
    expect(num(bill.sbPaidAmt)).toBe(680);
    expect(num(bill.sbBalanceAmt)).toBe(500);

    const tcs = await p.tempCredits(bill.sbId);
    expect(tcs).toHaveLength(1);
    atcId = tcs[0].atc_id;
    expect(tcs[0].atc_status).toBe('OPEN');
    expect(tcs[0].atc_name).toBe('Ravi (e2e)');
    expect(tcs[0].atc_mobile).toBe(MOBILE);
    expect(tcs[0].atc_days).toBe(10);
    expect(isoDay(tcs[0].atc_due_date)).toBe(addDays(today(), 10));
    expect(num(tcs[0].atc_credit_amount)).toBe(500);
    expect(num(tcs[0].atc_balance_amount)).toBe(500);
    expect(num(tcs[0].atc_bill_amount)).toBe(1180);

    // It hangs off the bill's balance row and its tender row.
    const [abl] = await p.balanceRows(SALE_BILL, bill.sbId);
    expect(tcs[0].atc_abl_id).toBe(abl.abl_id);
    expect(num(abl.abl_alloc_amount)).toBe(680);
    expect(num(abl.abl_pending_amount)).toBe(500);
    const tenders = await p.tenders(SALE_BILL, bill.sbId);
    expect(tenders).toHaveLength(2);
    cashTender = tenders.find((t) => Number(t.td_tender_type_id) === 1)!;
    const tcTender = tenders.find((t) => Number(t.td_tender_type_id) === 8)!;
    expect(tcs[0].atc_tender_id).toBe(tcTender.td_id);

    // Legs: party 1180, sales, two taxes, COGS pair, cash pair — nothing for TEMP_CR.
    const legs = await p.legs(bill.sbPostedVoucherId);
    expect(legs).toHaveLength(8);
    expect(
      legs.filter((l) => l.av_ledger_id === TENDER_LEDGER.CASH).map((l) => num(l.av_amount)),
    ).toEqual([680]);
    expect(await p.partyNet(WALK_IN, bill.sbId)).toBe(500);
    expect(bill.tempCredits).toHaveLength(1);
  });

  it('GET /temp-credits/open lists it, not overdue yet', async () => {
    const res = await get('temp-credits/open', { companyId: COMPANY, search: MOBILE });
    expect(res.status).toBe(200);
    const row = (res.body.data as Record<string, any>[]).find((r) => r.atcId === atcId);
    expect(row).toBeDefined();
    expect(row!.billId).toBe(bill.sbId);
    expect(row!.billRefno).toBe(bill.sbBillRefno);
    expect(num(row!.creditAmount)).toBe(500);
    expect(num(row!.balance)).toBe(500);
    expect(row!.status).toBe('OPEN');
    expect(row!.daysOverdue).toBe(0);
    expect(row!.dueDate).toBe(addDays(today(), 10));

    const overdue = await get('temp-credits/open', {
      companyId: COMPANY,
      search: MOBILE,
      overdueOnly: 'true',
    });
    expect(overdue.status).toBe(200);
    expect((overdue.body.data as Record<string, any>[]).some((r) => r.atcId === atcId)).toBe(false);
  });

  it('PUT /temp-credits/follow-up records the promise', async () => {
    const promise = addDays(today(), 5);
    const res = explain(
      'follow-up',
      await put('temp-credits/follow-up', {
        atcId,
        atcAccYear: ACC_YEAR,
        promiseDate: promise,
        remarks: `E2E-TENDER-${tag} will pay Friday`,
      }),
      200,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.promiseDate).toBe(promise);
    expect(res.body.data.followupOn).toBeTruthy();
    const [tc] = await p.tempCredits(bill.sbId);
    expect(isoDay(tc.atc_promise_date)).toBe(promise);
    expect(tc.atc_remarks).toBe(`E2E-TENDER-${tag} will pay Friday`);
  });

  it('GET /bills/tender-context is the re-tender dialog’s read', async () => {
    const res = await get('bills/tender-context', {
      sbId: bill.sbId,
      sbCompanyId: bill.sbCompanyId,
      sbBranchId: bill.sbBranchId,
      sbAccYear: bill.sbAccYear,
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).toContain(cashTender.td_id);
  });

  it('/bills/retender refuses a total that differs: 422 SALES_RETENDER_AMOUNT_MISMATCH', async () => {
    const res = await post('bills/retender', {
      ...billKeys(bill.sbId),
      voids: [{ tdId: cashTender.td_id, reason: 'KEYED_WRONG' }],
      tenders: [{ tdTenderId: TENDER.UPI, tdAmount: 600, tdRefNo: 'UTR-E2E-SHORT' }],
      remark: 'short',
    });
    expect(res.status).toBe(422);
    expect(codesOf(res)).toContain('SALES_RETENDER_AMOUNT_MISMATCH');
  });

  it('/bills/retender on the POSTED bill: cash voided, UPI in its place, a TndC contra, the party balance unchanged', async () => {
    const partyBefore = await p.partyNet(WALK_IN, bill.sbId);
    const [ablBefore] = await p.balanceRows(SALE_BILL, bill.sbId);

    const res = explain(
      'retender',
      await post('bills/retender', {
        ...billKeys(bill.sbId),
        voids: [{ tdId: cashTender.td_id, reason: 'KEYED_WRONG' }],
        tenders: [{ tdTenderId: TENDER.UPI, tdAmount: 680, tdRefNo: `UTR-E2E-${tag}` }],
        remark: `E2E-TENDER-${tag} it was UPI, not cash`,
      }),
      201,
    );
    expect(res.status).toBe(201);
    const after = res.body.data as Record<string, any>;
    expect(after.sbStatus).toBe('POSTED');
    expect(num(after.sbPaidAmt)).toBe(680);
    expect(num(after.sbBalanceAmt)).toBe(500);
    expect(after.sbPayStatus).toBe('PARTIAL');

    // The row that did not happen is kept, voided; the one that did replaces it.
    const tenders = await p.tenders(SALE_BILL, bill.sbId);
    const voided = tenders.find((t) => t.td_id === cashTender.td_id)!;
    expect(voided.td_is_voided).toBe(true);
    expect(voided.td_void_reason).toBe('KEYED_WRONG');
    const upi = tenders.find((t) => Number(t.td_tender_type_id) === 3)!;
    expect(upi).toBeDefined();
    expect(num(upi.td_amount)).toBe(680);
    expect(upi.td_is_voided).toBe(false);
    expect(upi.td_replaces_id).toBe(cashTender.td_id);
    const tc = tenders.find((t) => Number(t.td_tender_type_id) === 8)!;
    expect(tc.td_is_voided).toBe(false);

    // The contra: DR UPI 680 / CR cash 680, on voucher type 22, against the bill.
    const contras = await p.retenderContras(bill.sbId);
    expect(contras).toHaveLength(1);
    expect(contras[0].avh_voucher_type_id).toBe(VCHR.TENDER_CHANGE);
    expect(contras[0].avh_voucher_status.trim()).toBe('POSTED');
    expect(num(contras[0].avh_doc_amount)).toBe(680);
    const legs = await p.legs(contras[0].avh_voucher_id);
    expect(legs.map((l) => [l.av_dr_cr.trim(), l.av_ledger_id, num(l.av_amount)])).toEqual([
      ['DR', TENDER_LEDGER.UPI, 680],
      ['CR', TENDER_LEDGER.CASH, 680],
    ]);
    expect(legs.some((l) => l.av_ledger_id === WALK_IN)).toBe(false);

    // The party balance never moved — not on the ledger, not on the receivable.
    expect(await p.partyNet(WALK_IN, bill.sbId)).toBe(partyBefore);
    const [ablAfter] = await p.balanceRows(SALE_BILL, bill.sbId);
    expect(num(ablAfter.abl_pending_amount)).toBe(num(ablBefore.abl_pending_amount));
    expect(num(ablAfter.abl_alloc_amount)).toBe(680);
    // The bill's own voucher is untouched.
    const [billVoucher] = await p.vouchers(SALE_BILL, bill.sbId);
    expect(billVoucher.avh_voucher_status.trim()).toBe('POSTED');
    expect(await p.legs(billVoucher.avh_voucher_id)).toHaveLength(8);

    const trail = await p.trail(bill.sbId);
    expect(trail[trail.length - 1].tsl_event.trim()).toBe('RETENDERED');
    expect(trail[trail.length - 1].tsl_remarks).toBe(`E2E-TENDER-${tag} it was UPI, not cash`);
  });

  it('a voided tender cannot be voided twice: 409', async () => {
    const res = await post('bills/retender', {
      ...billKeys(bill.sbId),
      voids: [{ tdId: cashTender.td_id, reason: 'OTHER' }],
      tenders: [{ tdTenderId: TENDER.UPI, tdAmount: 680, tdRefNo: 'again' }],
      remark: 'again',
    });
    expect(res.status).toBe(409);
    expect(codesOf(res)).toContain('SALES_RETENDER_AMOUNT_MISMATCH');
  });

  it('/bills/cancel retires the temporary credit with the bill', async () => {
    const res = explain(
      'cancel',
      await post('bills/cancel', { ...billKeys(bill.sbId), reason: `E2E-TENDER-${tag} cancelled` }),
      201,
    );
    expect(res.status).toBe(201);
    const [tc] = await p.tempCredits(bill.sbId);
    expect(tc.atc_status).toBe('CANCELLED');
    expect(num(tc.atc_balance_amount)).toBe(0);
    expect(tc.atc_remarks).toBe(`E2E-TENDER-${tag} cancelled`);
    expect(await p.balanceRows(SALE_BILL, bill.sbId)).toHaveLength(0);
    expect(await p.partyNet(WALK_IN, bill.sbId)).toBe(0);

    const open = await get('temp-credits/open', { companyId: COMPANY, search: MOBILE });
    expect((open.body.data as Record<string, any>[]).some((r) => r.atcId === atcId)).toBe(false);
    const cancelled = await get('temp-credits/open', {
      companyId: COMPANY,
      search: MOBILE,
      status: 'CANCELLED',
    });
    expect((cancelled.body.data as Record<string, any>[]).some((r) => r.atcId === atcId)).toBe(
      true,
    );
  });
});
