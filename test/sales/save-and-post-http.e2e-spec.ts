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
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  bootApp,
  codesOf,
  dcBody,
  dcKeys,
  explain,
  grantSalesRights,
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
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from '../helpers/menu-rights';

/**
 * Notes 94 B / 106 — SAVE AND POST IN ONE CALL, on the three sales documents.
 *
 * `/create` with `post: true` (or the status the post would leave) runs the
 * draft save and the whole of `/post` in ONE transaction. The proof that
 * matters is the refusal: nothing is left behind and the number is not burned,
 * which is what the two-call Save & Post could never promise.
 *
 * Live DB. Posted documents are cancelled at the end (reversal, never a delete);
 * the refused ones must leave no row at all, which is the point.
 */

const tag = runTag();
const SALES_ORDER_MENU = 11;
const DELIVERY_CHALLAN_MENU = 182;
const SALE_BILL = 'SALE_BILL';
const DC = 'DELIVERY_CHALLAN';

const tail = (refno: string): number => Number(/(\d+)$/.exec(refno)?.[1] ?? NaN);

describe('save and post in one call — bills, orders, challans (e2e, live DB)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let orderRights: MenuRightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);

  const bill = (usrRefno: string, extra: Record<string, unknown> = {}) => ({
    ...billBody({
      custId: WALK_IN,
      custName: WALK_IN_NAME,
      lines: [{ item, qty: 10, rate: 100 }],
      usrRefno,
    }),
    ...extra,
  });

  const order = (usrRefno: string, extra: Record<string, unknown> = {}) => ({
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
    soUsrRefno: usrRefno,
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
    ...extra,
  });

  let postedBill: Record<string, any>;
  let aliasBill: Record<string, any>;
  let confirmedOrder: Record<string, any>;
  let postedDc: Record<string, any>;

  beforeAll(async () => {
    h = await bootApp(`e2e-sp-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    orderRights = await grantMenuRights(h.prisma, [SALES_ORDER_MENU]);
    item = await makeItem(h.prisma, `E2E-SP-${tag}`);
    await postOpeningStock(h, item, 100, 20, `E2E-SP-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma) {
      if (rights) await revokeSalesRights(h.prisma, rights);
      await restoreMenuRights(h.prisma, orderRights);
    }
    await shutdown(h);
  }, 60_000);

  // ─────────────────────────────────────────────────────────────── bills

  it('/bills/create with post: true saves and posts in one call', async () => {
    const res = explain(
      'bill one-call',
      await post('bills/create', bill(`E2E-SP-${tag}-B1`, { post: true })),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Bill created and posted successfully');
    postedBill = res.body.data;
    expect(postedBill.sbStatus).toBe('POSTED');
    expect(postedBill.sbPostedVoucherId).toBeTruthy();
    expect(postedBill.sbBillRefno).toBeTruthy();

    expect(await p.vouchers(SALE_BILL, postedBill.sbId)).toHaveLength(1);
    expect(await p.stockShadows(SALE_BILL, postedBill.sbId)).toHaveLength(1);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(90);

    // The trail reads CREATED → POSTED even though both arrived in one request.
    const trail = await p.trail(postedBill.sbId);
    expect(trail.map((r) => r.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
  });

  it('a refused one-call leaves no bill and burns no number', async () => {
    const refno = `E2E-SP-${tag}-REFUSED`;
    const res = await post('bills/create', bill(refno, { post: true, sbBillAmt: 1200 }));
    expect(res.status).toBe(422);
    // Exactly what /bills/post answers: the code list, not a save error.
    expect(codesOf(res)).toContain('SALES_AMOUNT_MISMATCH');

    const row = await h.prisma.saleBill.findFirst({ where: { sbUsrRefno: refno } });
    expect(row).toBeNull();

    // The next draft takes the number right after the posted bill: the refused
    // one consumed nothing.
    const draft = explain(
      'bill draft after refusal',
      await post('bills/create', bill(`E2E-SP-${tag}-DRAFT`)),
      201,
    );
    expect(draft.body.data.sbStatus).toBe('DRAFT');
    expect(tail(draft.body.data.sbBillRefno)).toBe(tail(postedBill.sbBillRefno) + 1);
    await post('bills/delete', billKeys(draft.body.data.sbId));
  });

  it("sbStatus: 'POSTED' is the same instruction as post: true", async () => {
    const res = explain(
      'bill alias',
      await post('bills/create', bill(`E2E-SP-${tag}-B2`, { sbStatus: 'POSTED' })),
      201,
    );
    expect(res.status).toBe(201);
    aliasBill = res.body.data;
    expect(aliasBill.sbStatus).toBe('POSTED');
    expect(await p.vouchers(SALE_BILL, aliasBill.sbId)).toHaveLength(1);
  });

  it('a one-call on an existing draft posts it in place', async () => {
    const draft = explain('draft', await post('bills/create', bill(`E2E-SP-${tag}-B3`)), 201);
    const sbId = draft.body.data.sbId as string;
    const res = explain(
      'draft one-call',
      await post('bills/create', bill(`E2E-SP-${tag}-B3`, { sbId, post: true })),
      201,
    );
    expect(res.body.message).toBe('Bill updated and posted successfully');
    expect(res.body.data.sbId).toBe(sbId);
    expect(res.body.data.sbStatus).toBe('POSTED');
    // Cancel it right away — three bills of 10 is enough stock to hold.
    const cancel = await post('bills/cancel', { ...billKeys(sbId), reason: 'E2E-SP tidy up' });
    expect(cancel.status).toBe(201);
  });

  // ─────────────────────────────────────────────────────────────── orders

  it('/sale-orders/create with post: true saves and confirms in one call', async () => {
    const res = explain(
      'order one-call',
      await post('sale-orders/create', order(`E2E-SP-${tag}-SO1`, { post: true })),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/^Order created and confirmed/);
    confirmedOrder = res.body.data;
    expect(confirmedOrder.soStatus).toBe('CONFIRMED');
    expect(Array.isArray(confirmedOrder.warnings)).toBe(true);
    expect(confirmedOrder.soOrderRefno).toBeTruthy();
    const trail = await p.trail(confirmedOrder.soId);
    expect(trail.map((r) => r.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
  });

  it("soStatus: 'CONFIRMED' no longer writes the column — it confirms through /post", async () => {
    const res = explain(
      'order alias',
      await post('sale-orders/create', order(`E2E-SP-${tag}-SO2`, { soStatus: 'CONFIRMED' })),
      201,
    );
    expect(res.body.data.soStatus).toBe('CONFIRMED');
    const trail = await p.trail(res.body.data.soId);
    expect(trail.map((r) => r.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
    const cancel = await post('sale-orders/cancel', {
      soId: res.body.data.soId,
      soCompanyId: COMPANY,
      soBranchId: BRANCH,
      soAccYear: ACC_YEAR,
      reason: 'E2E-SP tidy up',
    });
    expect(cancel.status).toBe(201);
  });

  it('a one-call the Post right refuses leaves no order behind', async () => {
    const refno = `E2E-SP-${tag}-SO-NORIGHT`;
    await h.prisma.$executeRaw`
      UPDATE public.user_menus SET um_can_post = false
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${SALES_ORDER_MENU}::int AND um_is_deleted = false`;
    try {
      const res = await post('sale-orders/create', order(refno, { post: true }));
      expect(res.status).toBe(403);
      expect(codesOf(res)).toContain('SALES_RIGHT_POST');
      expect(await h.prisma.saleOrder.findFirst({ where: { soUsrRefno: refno } })).toBeNull();
    } finally {
      await h.prisma.$executeRaw`
        UPDATE public.user_menus SET um_can_post = true
         WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${SALES_ORDER_MENU}::int AND um_is_deleted = false`;
    }
  });

  // ─────────────────────────────────────────────────────────────── challans

  it("/delivery-challans/create with sdcStatus: 'POSTED' saves and posts in one call", async () => {
    const res = explain(
      'dc one-call',
      await post('delivery-challans/create', {
        ...dcBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 20, rate: 100 }],
          usrRefno: `E2E-SP-${tag}-DC`,
        }),
        sdcStatus: 'POSTED',
      }),
      201,
    );
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Challan created and posted successfully');
    postedDc = res.body.data;
    expect(postedDc.sdcStatus).toBe('POSTED');
    expect(postedDc.sdcPostedVoucherId).toBeTruthy();
    expect(await p.stockShadows(DC, postedDc.sdcId)).toHaveLength(1);
    // 100 − 10 (B1) − 10 (B2) − 20 (DC); B3 was cancelled.
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(60);
    const trail = await p.trail(postedDc.sdcId);
    expect(trail.map((r) => r.tsl_event.trim())).toEqual(['CREATED', 'POSTED']);
  });

  it('a refused challan one-call leaves no row', async () => {
    // This godown allows negative stock, so the refusal that holds on any
    // settings is the Post right: nothing may be written when it is missing.
    const refno = `E2E-SP-${tag}-DC-REFUSED`;
    await h.prisma.$executeRaw`
      UPDATE public.user_menus SET um_can_post = false
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${DELIVERY_CHALLAN_MENU}::int AND um_is_deleted = false`;
    try {
      const res = await post('delivery-challans/create', {
        ...dcBody({
          custId: LISTED_CUSTOMER,
          custName: LISTED_CUSTOMER_NAME,
          lines: [{ item, qty: 5, rate: 100 }],
          usrRefno: refno,
        }),
        post: true,
      });
      expect(res.status).toBe(403);
      expect(codesOf(res)).toContain('SALES_RIGHT_POST');
      expect(await h.prisma.saleDc.findFirst({ where: { sdcUsrRefno: refno } })).toBeNull();
    } finally {
      await h.prisma.$executeRaw`
        UPDATE public.user_menus SET um_can_post = true
         WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${DELIVERY_CHALLAN_MENU}::int AND um_is_deleted = false`;
    }
  });

  // ─────────────────────────────────────────────────────────────── tidy up

  it('cancels what it posted', async () => {
    for (const b of [postedBill, aliasBill]) {
      const res = await post('bills/cancel', { ...billKeys(b.sbId), reason: 'E2E-SP tidy up' });
      expect(res.status).toBe(201);
    }
    const dc = await post('delivery-challans/cancel', {
      ...dcKeys(postedDc.sdcId),
      reason: 'E2E-SP tidy up',
    });
    expect(dc.status).toBe(201);
    const so = await post('sale-orders/cancel', {
      soId: confirmedOrder.soId,
      soCompanyId: COMPANY,
      soBranchId: BRANCH,
      soAccYear: ACC_YEAR,
      reason: 'E2E-SP tidy up',
    });
    expect(so.status).toBe(201);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(100);
  });
});
