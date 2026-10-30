import '../../src/env.preload';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma/prisma.service';
import { LoyaltyLedgerService } from '../../src/modules/sales/posting/loyalty-ledger.service';
import type { LoyaltyBillSource } from '../../src/modules/sales/posting/types/loyalty.types';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from '../helpers/menu-rights';
import {
  ACC_YEAR,
  ACTOR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  bootApp,
  makeItem,
  shutdown,
  type Harness,
  type Item,
} from './sales-e2e.harness';

/**
 * Loyalty Status (plan 2026-10-05 §10) — the report routes and the two
 * actions, over HTTP, against committed fixtures torn down in afterAll.
 *
 * The suite needs: menu 79 (granted to tester1 here and put back after), a
 * company with two customers that hold no wallet yet, and the 2026-2027
 * partitions. Run with --runInBand like every suite that grants rights.
 */
const R = `${API}/reports/loyalty-status`;
const A = `${API}/loyalty/members`;
const MENU = 79;
const D1 = '2026-04-01';
const D2 = '2026-05-01';
const D3 = '2026-06-01';

const prisma = new PrismaClient();
const ledger = new LoyaltyLedgerService(prisma as unknown as PrismaService);

interface Fixture {
  schemeId: string;
  schemeName: string;
  cheapGift: string;
  dearGift: string;
  items: Item[];
  member1: string;
  member2: string;
  cust1: string;
  cust2: string;
  cancelledDoc: string;
  today: string;
}

let h: Harness;
let fx: Fixture | null = null;
let rights: MenuRightsMemo | null = null;

function bill(
  custId: string,
  memberId: string,
  date: string,
  netAmt: number,
  docId = randomUUID(),
): LoyaltyBillSource {
  return {
    docId,
    accYear: ACC_YEAR,
    companyId: COMPANY,
    branchId: BRANCH,
    custId,
    docDate: date,
    docRefno: `TSTLS/${date}`,
    docType: 'SALE_BILL',
    billType: null,
    memberId,
    chargesAmt: 0,
    redeemedAmount: 0,
    lines: [
      {
        lineNo: 1,
        itemId: randomUUID(),
        unitId: null,
        qty: 1,
        grossAmt: netAmt,
        netAmt,
        taxableAmt: netAmt,
        isFree: false,
        allowLoyalty: true,
        groupId: null,
        categoryId: null,
        brandId: null,
        sectionId: null,
      },
    ],
  };
}

async function get(path: string, query: Record<string, unknown>) {
  return h.http.get(path).set('Authorization', BEARER).query(query);
}
async function post(path: string, body: Record<string, unknown>) {
  return h.http.post(path).set('Authorization', BEARER).send(body);
}

beforeAll(async () => {
  const customers = await prisma.$queryRaw<{ cus_id: string }[]>`
    SELECT c.cus_id FROM sales.customers c
     WHERE c.cus_company_id = ${COMPANY}::uuid AND c.cus_is_deleted = false
       AND NOT EXISTS (SELECT 1 FROM sales.loyalty_member m WHERE m.lmb_cust_id = c.cus_id)
     ORDER BY c.cus_id LIMIT 2`;
  if (customers.length < 2) {
    console.warn('\n[loyalty-status e2e] SKIPPED — fewer than two customers without a wallet.\n');
    return;
  }
  const [{ d: today }] = await prisma.$queryRaw<{ d: string }[]>`SELECT CURRENT_DATE::text AS d`;
  const tag = Date.now().toString(36).toUpperCase();
  const schemeName = `Loyalty status test ${tag}`;
  const [scheme] = await prisma.$queryRaw<{ lsc_id: string }[]>`
    INSERT INTO sales.loyalty_scheme
      (lsc_comp_id, lsc_code, lsc_name, lsc_type, lsc_status, lsc_priority,
       lsc_apply_on, lsc_calc_on_amount_type, lsc_bill_type,
       lsc_branch_scope, lsc_cust_scope, lsc_item_scope,
       lsc_allow_point_redeem, lsc_allow_gift_redeem, lsc_redeem_value_per_point,
       lsc_expiry_basis, lsc_points_valid_days, lsc_activation_days,
       lsc_rounding_method, lsc_points_decimals, lsc_return_mode,
       lsc_start_date, lsc_end_date, lsc_approved_by, lsc_approved_on, lsc_created_by)
    VALUES
      (${COMPANY}::uuid, ${'TSTLS' + tag}, ${schemeName}, 'BOTH', 'APPROVED', 9,
       'BILL_AMOUNT', 'NET_AMOUNT', 'ALL', 'ALL', 'ALL', 'ALL',
       true, true, 1,
       'EARN_DATE', 365, 0,
       'ROUND', 0, 'REVERSE',
       ${D1}::date, '2027-03-31'::date, ${ACTOR}::uuid, now(), 'TEST')
    RETURNING lsc_id`;
  await prisma.$executeRaw`
    INSERT INTO sales.loyalty_scheme_slab (lss_lsc_id, lss_slno, lss_each, lss_points, lss_created_by)
    VALUES (${scheme.lsc_id}::uuid, 1, 100, 1, 'TEST')`;
  const items = [await makeItem(prisma, `TSTLS${tag}A`), await makeItem(prisma, `TSTLS${tag}B`)];
  const gifts = await prisma.$queryRaw<{ lsg_id: string; lsg_slno: number }[]>`
    INSERT INTO sales.loyalty_scheme_gift
      (lsg_lsc_id, lsg_slno, lsg_item_id, lsg_unit_id, lsg_item_qty, lsg_redeem_points,
       lsg_repeat, lsg_stock_check, lsg_created_by)
    VALUES
      (${scheme.lsc_id}::uuid, 1, ${items[0].itemId}::uuid, ${items[0].iucId}::uuid, 1, 10, false, false, 'TEST'),
      (${scheme.lsc_id}::uuid, 2, ${items[1].itemId}::uuid, ${items[1].iucId}::uuid, 1, 30, false, false, 'TEST')
    RETURNING lsg_id, lsg_slno`;
  const members: string[] = [];
  for (const [i, c] of customers.entries()) {
    const [m] = await prisma.$queryRaw<{ lmb_id: string }[]>`
      INSERT INTO sales.loyalty_member
        (lmb_comp_id, lmb_branch_id, lmb_acc_year, lmb_cust_id, lmb_card_no, lmb_mobile,
         lmb_enrolled_on, lmb_created_by)
      VALUES
        (${COMPANY}::uuid, ${BRANCH}::uuid, ${ACC_YEAR}::char(9), ${c.cus_id}::uuid,
         ${`TSTLS${tag}-${i + 1}`}, ${`99999${tag.slice(-5)}${i}`},
         ${D1}::date, 'TEST')
      RETURNING lmb_id`;
    members.push(m.lmb_id);
  }
  const [cust1, cust2] = customers.map((c) => c.cus_id);
  const [member1, member2] = members;
  const cancelledDoc = randomUUID();

  // member 1: 10 + 20 + 30 points, then the D2 bill is cancelled → 40
  await prisma.$transaction(async (tx) => {
    await ledger.earn(tx, bill(cust1, member1, D1, 1000), { memberId: member1, createdBy: 'TEST' });
    await ledger.earn(tx, bill(cust1, member1, D2, 2000, cancelledDoc), {
      memberId: member1,
      createdBy: 'TEST',
    });
    await ledger.earn(tx, bill(cust1, member1, D3, 3000), { memberId: member1, createdBy: 'TEST' });
    await ledger.reverseForCancel(
      tx,
      { docId: cancelledDoc, accYear: ACC_YEAR, docType: 'SALE_BILL', docRefno: `TSTLS/${D2}` },
      { reason: 'cancelled in test', createdBy: 'TEST' },
    );
  });
  // member 2: the scheme now cools points for 10 days; a bill today → 50 cooling
  await prisma.$executeRaw`
    UPDATE sales.loyalty_scheme SET lsc_activation_days = 10 WHERE lsc_id = ${scheme.lsc_id}::uuid`;
  await prisma.$transaction(async (tx) => {
    await ledger.earn(tx, bill(cust2, member2, today, 5000), {
      memberId: member2,
      createdBy: 'TEST',
    });
  });

  fx = {
    schemeId: scheme.lsc_id,
    schemeName,
    cheapGift: gifts.find((g) => g.lsg_slno === 1)!.lsg_id,
    dearGift: gifts.find((g) => g.lsg_slno === 2)!.lsg_id,
    items,
    member1,
    member2,
    cust1,
    cust2,
    cancelledDoc,
    today,
  };
  h = await bootApp(randomUUID());
}, 120_000);

afterAll(async () => {
  if (rights) {
    await restoreMenuRights(prisma, rights);
  }
  if (fx) {
    const ids = [fx.member1, fx.member2];
    await prisma.$executeRaw`DELETE FROM public.txn_status_log WHERE tsl_src_doc_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM sales.loyalty_ledger WHERE lld_member_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM sales.loyalty_member WHERE lmb_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM sales.loyalty_scheme_gift WHERE lsg_lsc_id = ${fx.schemeId}::uuid`;
    await prisma.$executeRaw`DELETE FROM sales.loyalty_scheme_slab WHERE lss_lsc_id = ${fx.schemeId}::uuid`;
    await prisma.$executeRaw`DELETE FROM sales.loyalty_scheme WHERE lsc_id = ${fx.schemeId}::uuid`;
    const itemIds = fx.items.map((i) => i.itemId);
    await prisma.$executeRaw`DELETE FROM inventory.item_unit_conversion WHERE iuc_item_id = ANY(${itemIds}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM inventory.item_master WHERE item_id = ANY(${itemIds}::uuid[])`;
  }
  await shutdown(h);
  await prisma.$disconnect();
});

describe('Loyalty Status — report routes and actions (http)', () => {
  it('refuses without view on menu 79, then grants it', async () => {
    if (!fx) return;
    const res = await get(`${R}/members`, { companyId: COMPANY, lscId: fx.schemeId });
    rights = await grantMenuRights(prisma, [MENU]);
    expect(res.status).toBe(403);
    // the global filter nests a 403's details under `message`, so read the text
    expect(JSON.stringify(res.body)).toContain('LST_RIGHT_VIEW');
  });

  it('1 · members: the grid, and summary.outstanding = Σ lmb_balance_points', async () => {
    if (!fx) return;
    const res = await get(`${R}/members`, { companyId: COMPANY, lscId: fx.schemeId });
    expect(res.status).toBe(200);
    const { items, total, summary, asOn } = res.body.data;
    expect(asOn).toBe(fx.today);
    expect(total).toBe(2);
    const [{ sum }] = await prisma.$queryRaw<{ sum: unknown }[]>`
      SELECT SUM(lmb_balance_points) AS sum FROM sales.loyalty_member
       WHERE lmb_id = ANY(${[fx.member1, fx.member2]}::uuid[])`;
    expect(summary.outstanding).toBe(Number(sum));
    expect(summary.outstanding).toBe(90);
    expect(summary.members).toBe(2);
    expect(summary.active).toBe(2);
    const m1 = items.find((i: { memberId: string }) => i.memberId === fx!.member1);
    expect(m1.balance).toBe(40);
    expect(m1.earned).toBe(40);
    // notes 91 N3: the wallet was enrolled with no scheme; its first EARN stamped one
    expect(m1.lscId).toBe(fx.schemeId);
    expect(m1.schemeName).toBe(fx.schemeName);
    expect(m1.value).toBe('40.00');
    // notes 91 N2: the summary's value is Σ of the rows' value
    const valueSum = (items as { value: string | null }[])
      .reduce((t, i) => t + Number(i.value ?? 0), 0)
      .toFixed(2);
    expect(summary.outstandingValue).toBe(valueSum);
    expect(summary.outstandingValue).toBe('40.00'); // member 2's 50 are cooling, not redeemable
  });

  it('2 · redeemable on every row = LoyaltyLedgerService.redeemable() (D1 parity)', async () => {
    if (!fx) return;
    const res = await get(`${R}/members`, { companyId: COMPANY, lscId: fx.schemeId });
    for (const item of res.body.data.items as { memberId: string; redeemable: number }[]) {
      expect(item.redeemable).toBe(await ledger.redeemable(item.memberId, fx.today));
    }
  });

  it('3 · a bill cooling for 10 days shows under cooling, not redeemable, and drops out of eligibleOnly', async () => {
    if (!fx) return;
    const all = await get(`${R}/members`, { companyId: COMPANY, lscId: fx.schemeId });
    const m2 = all.body.data.items.find((i: { memberId: string }) => i.memberId === fx!.member2);
    expect(m2.balance).toBe(50);
    expect(m2.cooling).toBe(50);
    expect(m2.redeemable).toBe(0);
    expect(m2.eligible).toBe(false);
    expect(m2.bestGift).toBeNull();
    const m1 = all.body.data.items.find((i: { memberId: string }) => i.memberId === fx!.member1);
    expect(m1.eligible).toBe(true);
    expect(m1.bestGift.lsgId).toBe(fx.dearGift); // the dearest ≤ 40 redeemable
    expect(m1.bestGift.qty).toBe(1);
    const eligible = await get(`${R}/members`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      eligibleOnly: true,
    });
    expect(eligible.body.data.items.map((i: { memberId: string }) => i.memberId)).toEqual([
      fx.member1,
    ]);
    expect(eligible.body.data.summary.giftEligible).toBe(1);
  });

  it('4 · earnedFrom / earnedTo around a cancelled bill: earned nets the reversal', async () => {
    if (!fx) return;
    const res = await get(`${R}/members`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      earnedFrom: D2,
      earnedTo: D2,
    });
    const m1 = res.body.data.items.find((i: { memberId: string }) => i.memberId === fx!.member1);
    expect(m1.earned).toBe(0);
    expect(res.body.data.summary.earnedInPeriod).toBe(0);
  });

  it('5 · statement: closing = lmb_balance_points, unchanged with showReversals = false', async () => {
    if (!fx) return;
    const full = await get(`${R}/statement`, { companyId: COMPANY, memberId: fx.member1 });
    expect(full.status).toBe(200);
    expect(full.body.data.closing).toBe(40);
    expect(full.body.data.rows).toHaveLength(4);
    expect(full.body.data.rows.filter((r: { isReversal: boolean }) => r.isReversal)).toHaveLength(
      1,
    );
    const clean = await get(`${R}/statement`, {
      companyId: COMPANY,
      memberId: fx.member1,
      showReversals: false,
    });
    expect(clean.body.data.closing).toBe(40);
    expect(clean.body.data.rows).toHaveLength(2);
    const fromD3 = await get(`${R}/statement`, {
      companyId: COMPANY,
      memberId: fx.member1,
      from: D3,
    });
    expect(fromD3.body.data.opening).toBe(10);
    expect(fromD3.body.data.rows).toHaveLength(1);
    expect(fromD3.body.data.rows[0].runningBalance).toBe(40);
  });

  it('6 · expiring within 365 days sums to Σ lots expiring within a year', async () => {
    if (!fx) return;
    const res = await get(`${R}/expiring`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      withinDays: 365,
    });
    expect(res.status).toBe(200);
    const [{ sum }] = await prisma.$queryRaw<{ sum: unknown }[]>`
      SELECT SUM(lld_lot_balance) AS sum FROM sales.loyalty_ledger
       WHERE lld_member_id = ANY(${[fx.member1, fx.member2]}::uuid[])
         AND lld_is_deleted = false AND lld_lot_balance > 0
         AND lld_expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 365`;
    expect(res.body.data.summary.points).toBe(Number(sum));
    expect(res.body.data.summary.members).toBe(2);
    expect(res.body.data.items.length).toBe(res.body.data.total);
    const calendar = await get(`${R}/expiring/calendar`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      days: 400,
    });
    expect(calendar.status).toBe(200);
    const points = calendar.body.data.weeks.reduce(
      (s: number, w: { points: number }) => s + w.points,
      0,
    );
    expect(points).toBe(Number(sum));
  });

  it('7 · schemes: Σ outstanding = Σ balances; monthly and gifts agree', async () => {
    if (!fx) return;
    const res = await get(`${R}/schemes`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      from: D1,
      to: fx.today,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    const s = res.body.data.items[0];
    expect(s.outstanding).toBe(90);
    expect(s.earned).toBe(90);
    expect(s.bills).toBe(4);
    expect(s.holders).toBe(2);
    expect(s.value).toBe('90.00');
    expect(res.body.data.summary.outstanding).toBe(90);

    const monthly = await get(`${R}/schemes/monthly`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      from: D1,
      to: fx.today,
    });
    expect(monthly.status).toBe(200);
    const months = monthly.body.data.months as {
      month: string;
      earned: number;
      partial: boolean;
    }[];
    expect(months[0].month).toBe('2026-04');
    expect(months.find((m) => m.month === '2026-05')!.earned).toBe(0); // 20 − 20
    expect(months.reduce((t, m) => t + m.earned, 0)).toBe(90);
    expect(months[months.length - 1].partial).toBe(fx.today.slice(8) !== '31' || true);

    // 8 · eligibleMembers for the cheapest gift ≥ that of every dearer gift
    const gifts = await get(`${R}/schemes/gifts`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      from: D1,
      to: fx.today,
    });
    expect(gifts.status).toBe(200);
    const g = gifts.body.data.gifts as {
      lsgId: string;
      eligibleMembers: number;
      inStock: unknown;
    }[];
    const cheap = g.find((x) => x.lsgId === fx!.cheapGift)!;
    const dear = g.find((x) => x.lsgId === fx!.dearGift)!;
    expect(cheap.eligibleMembers).toBeGreaterThanOrEqual(dear.eligibleMembers);
    expect(cheap.eligibleMembers).toBe(1);
    expect(cheap.inStock).toBeNull(); // lsg_stock_check = false
  });

  it('10 · adjust without approvedBy → 400 from the DTO', async () => {
    if (!fx) return;
    const res = await post(`${A}/adjust`, {
      companyId: COMPANY,
      branchId: BRANCH,
      memberId: fx.member1,
      points: 5,
      reason: 'no approver',
    });
    expect(res.status).toBe(400);
  });

  it('9 · ADJUST +25 is a lot: balance and redeemable rise, unlotted stays 0', async () => {
    if (!fx) return;
    const res = await post(`${A}/adjust`, {
      companyId: COMPANY,
      branchId: BRANCH,
      memberId: fx.member1,
      points: 25,
      reason: 'goodwill',
      approvedBy: ACTOR,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.rowsWritten).toBe(1);
    expect(res.body.data.balance).toBe(65);
    expect(res.body.data.redeemable).toBe(65);

    const card = await get(`${R}/member`, { companyId: COMPANY, memberId: fx.member1 });
    expect(card.status).toBe(200);
    expect(card.body.data.balance).toBe(65);
    expect(card.body.data.redeemable).toBe(await ledger.redeemable(fx.member1, fx.today));
    expect(card.body.data.unlotted).toBe(0);
    const adjustLot = card.body.data.lots.find((l: { txnType: string }) => l.txnType === 'ADJUST');
    expect(adjustLot.left).toBe(25);
    expect(adjustLot.expiresOn).toBeNull();
    expect(adjustLot.state).toBe('REDEEMABLE');
    expect(card.body.data.rules.redeemValuePerPoint).toBe('1.0000');

    // a take-back beyond the redeemable balance is refused …
    const tooMuch = await post(`${A}/adjust`, {
      companyId: COMPANY,
      branchId: BRANCH,
      memberId: fx.member1,
      points: -100,
      reason: 'too much',
      approvedBy: ACTOR,
    });
    expect(tooMuch.status).toBe(422);
    expect(JSON.stringify(tooMuch.body)).toContain('SALES_LOYALTY_CAP');
    // … and a take-back within it draws FIFO on the oldest-expiring lot
    const back = await post(`${A}/adjust`, {
      companyId: COMPANY,
      branchId: BRANCH,
      memberId: fx.member1,
      points: -5,
      reason: 'correction',
      approvedBy: ACTOR,
    });
    expect(back.status).toBe(200);
    expect(back.body.data.balance).toBe(60);
    expect(back.body.data.redeemable).toBe(60);
    const after = await get(`${R}/member`, { companyId: COMPANY, memberId: fx.member1 });
    const oldest = after.body.data.lots[0];
    expect(oldest.earnedOn).toBe(D1);
    expect(oldest.used).toBe(5);
    expect(after.body.data.unlotted).toBe(0);
    const st = await get(`${R}/statement`, { companyId: COMPANY, memberId: fx.member1 });
    expect(st.body.data.closing).toBe(60);
    const adj = st.body.data.rows.filter((r: { txnType: string }) => r.txnType === 'ADJUST');
    expect(adj).toHaveLength(2);
    expect(adj[1].lotId).toBe(oldest.lotId);
    expect(adj[0].reason).toBe('goodwill');
  });

  it('11 · CLOSED with a balance is refused; SUSPENDED works; force closes through a drain', async () => {
    if (!fx) return;
    const refused = await post(`${A}/status`, {
      companyId: COMPANY,
      memberId: fx.member2,
      status: 'CLOSED',
      reason: 'left town',
    });
    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.body)).toContain('LOYALTY_MEMBER_HAS_BALANCE');

    const noReason = await post(`${A}/status`, {
      companyId: COMPANY,
      memberId: fx.member2,
      status: 'SUSPENDED',
    });
    expect(noReason.status).toBe(400);

    const suspended = await post(`${A}/status`, {
      companyId: COMPANY,
      memberId: fx.member2,
      status: 'SUSPENDED',
      reason: 'card reported lost',
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.fromStatus).toBe('ACTIVE');
    expect(suspended.body.data.toStatus).toBe('SUSPENDED');
    const listed = await get(`${R}/members`, { companyId: COMPANY, lscId: fx.schemeId });
    const m2 = listed.body.data.items.find((i: { memberId: string }) => i.memberId === fx!.member2);
    expect(m2.status).toBe('SUSPENDED');
    expect(listed.body.data.summary.suspended).toBe(1);

    const forced = await post(`${A}/status`, {
      companyId: COMPANY,
      memberId: fx.member2,
      status: 'CLOSED',
      reason: 'left town',
      force: true,
      approvedBy: ACTOR,
    });
    expect(forced.status).toBe(200);
    expect(forced.body.data.balance).toBe(0);
    expect(forced.body.data.drained.rowsWritten).toBe(1); // the one cooling lot
    expect(await ledger.balance(fx.member2)).toBe(0);
    expect(await ledger.redeemable(fx.member2, fx.today)).toBe(0);

    const history = await get(`${A}/history`, { companyId: COMPANY, memberId: fx.member2 });
    expect(history.status).toBe(200);
    expect(history.body.data.steps.map((s: { toStatus: string }) => s.toStatus)).toEqual([
      'SUSPENDED',
      'CLOSED',
    ]);

    // a closed, empty wallet is out of the default list and in with includeMergedClosed
    const dflt = await get(`${R}/members`, { companyId: COMPANY, lscId: fx.schemeId });
    expect(dflt.body.data.items.map((i: { memberId: string }) => i.memberId)).toEqual([fx.member1]);
    const all = await get(`${R}/members`, {
      companyId: COMPANY,
      lscId: fx.schemeId,
      includeMergedClosed: true,
      balanceGtZero: false,
    });
    expect(all.body.data.total).toBe(2);
  });

  it('N1 · a soft-deleted scheme still shows on the summary while it holds points', async () => {
    if (!fx) return;
    await prisma.$executeRaw`
      UPDATE sales.loyalty_scheme SET lsc_is_deleted = true WHERE lsc_id = ${fx.schemeId}::uuid`;
    try {
      const res = await get(`${R}/schemes`, {
        companyId: COMPANY,
        lscId: fx.schemeId,
        from: D1,
        to: fx.today,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].status).toBe('DELETED');
      expect(res.body.data.items[0].outstanding).toBe(60); // member 1's 60; member 2 was drained
      expect(res.body.data.summary.outstanding).toBe(60);
      const all = await get(`${R}/schemes`, { companyId: COMPANY, from: D1, to: fx.today });
      expect(all.body.data.items.some((i: { lscId: string }) => i.lscId === fx!.schemeId)).toBe(
        true,
      );
      const monthly = await get(`${R}/schemes/monthly`, {
        companyId: COMPANY,
        lscId: fx.schemeId,
        from: D1,
        to: fx.today,
      });
      const earned = monthly.body.data.months.reduce(
        (t: number, m: { earned: number }) => t + m.earned,
        0,
      );
      expect(earned).toBe(90); // the two routes agree on the deleted scheme
      const dropped = await get(`${R}/schemes`, {
        companyId: COMPANY,
        lscId: fx.schemeId,
        from: D1,
        to: fx.today,
        includeClosedHolding: false,
      });
      expect(dropped.body.data.items).toHaveLength(0);
    } finally {
      await prisma.$executeRaw`
        UPDATE sales.loyalty_scheme SET lsc_is_deleted = false WHERE lsc_id = ${fx.schemeId}::uuid`;
    }
  });

  it('12 · export: the printed line carries every filter that was sent', async () => {
    if (!fx) return;
    const res = await get(`${R}/export`, {
      companyId: COMPANY,
      branchId: BRANCH,
      tab: 'members',
      format: 'pdf',
      lscId: fx.schemeId,
      eligibleOnly: true,
      pointsMin: 10,
      pointsMax: 500,
      earnedFrom: D1,
      earnedTo: fx.today,
      search: 'TSTLS',
      sort: 'balance',
      order: 'desc',
    });
    expect(res.status).toBe(200);
    const line = res.body.data.printedAs as string;
    for (const part of [
      'Loyalty Status — Members',
      'Branch: Acme Foods - Coimbatore Branch',
      `Scheme: ${fx.schemeName}`,
      'Status: ACTIVE / SUSPENDED',
      'Balance > 0',
      'Eligible customers only',
      'Points 10 to 500',
      'Earned 01-04-2026 to',
      'Search "TSTLS"',
      'Sorted by balance desc',
      'As on',
    ]) {
      expect(line).toContain(part);
    }
    expect(res.body.data.totalRows).toBe(1);
    expect(res.body.data.format).toBe('pdf');
  });
});
