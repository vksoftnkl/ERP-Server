// Preload .env exactly like src/main.ts, so DATABASE_URL is present before the
// PrismaClient is constructed.
import '../../src/env.preload';

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma/prisma.service';
import { LoyaltyLedgerService } from '../../src/modules/sales/posting/loyalty-ledger.service';

/**
 * The FIRST of `schema/13`'s four required tests, and the only one that cannot
 * live in a rolled-back transaction: **two concurrent redeems of one wallet
 * must serialise, and the second must see the first's spend.**
 *
 * It needs two REAL transactions running at once against COMMITTED fixtures,
 * so this file commits its own and tears them down in `afterAll`.
 *
 * ── What is actually being proved ──────────────────────────────────────────
 *
 * `consume()` step 2 takes `SELECT … FOR UPDATE` on the member row and
 * deliberately NOT `FOR UPDATE SKIP LOCKED`. With 100 points in the wallet and
 * two tills each asking for 60:
 *
 *   * with the lock — one blocks until the other commits, then re-reads 40
 *     redeemable and is refused. Exactly one succeeds, the wallet ends at 40.
 *   * with SKIP LOCKED, or with no lock at all — both read 100, both succeed,
 *     and the wallet ends at -20. That is the supermarket race, and it is the
 *     reason this file exists.
 *
 *     npm run test:e2e -- loyalty-concurrency
 */

const ACC_YEAR = '2026-2027';
const EARN_ON = '2026-04-01';
const SPEND_ON = '2026-06-02';

const prisma = new PrismaClient();

interface Fixture {
  companyId: string;
  branchId: string;
  custId: string;
  memberId: string;
  schemeId: string;
}

let fixture: Fixture | null = null;

beforeAll(async () => {
  const rows = await prisma.$queryRaw<
    { comp_id: string; br_id: string; cus_id: string; usr_id: string }[]
  >`
    SELECT b.br_comp_id AS comp_id, b.br_id, c.cus_id,
           (SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1) AS usr_id
      FROM public.branch_master b
      JOIN sales.customers c ON c.cus_company_id = b.br_comp_id
     WHERE b.br_is_deleted = false AND c.cus_is_deleted = false
     LIMIT 1`;
  if (rows.length === 0 || !rows[0].usr_id) {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[loyalty-concurrency e2e] SKIPPED — no company has a branch, a customer and a user.\n',
    );
    return;
  }
  const { comp_id: companyId, br_id: branchId, cus_id: custId, usr_id: userId } = rows[0];

  const [scheme] = await prisma.$queryRaw<{ lsc_id: string }[]>`
    INSERT INTO sales.loyalty_scheme
      (lsc_comp_id, lsc_code, lsc_name, lsc_type, lsc_status, lsc_priority,
       lsc_apply_on, lsc_calc_on_amount_type, lsc_bill_type,
       lsc_branch_scope, lsc_cust_scope, lsc_item_scope,
       lsc_allow_point_redeem, lsc_redeem_value_per_point,
       lsc_expiry_basis, lsc_points_valid_days, lsc_activation_days,
       lsc_rounding_method, lsc_points_decimals, lsc_return_mode,
       lsc_start_date, lsc_end_date, lsc_approved_by, lsc_approved_on, lsc_created_by)
    VALUES
      (${companyId}::uuid, ${'TSTCONC' + Date.now().toString(36)}, 'Loyalty concurrency test',
       'BOTH', 'APPROVED', 9,
       'BILL_AMOUNT', 'NET_AMOUNT', 'ALL', 'ALL', 'ALL', 'ALL',
       true, 1,
       'EARN_DATE', 365, 0,
       'ROUND', 0, 'REVERSE',
       ${EARN_ON}::date, '2027-03-31'::date, ${userId}::uuid, now(), 'TEST')
    RETURNING lsc_id`;

  await prisma.$executeRaw`
    INSERT INTO sales.loyalty_scheme_slab
      (lss_lsc_id, lss_slno, lss_each, lss_points, lss_created_by)
    VALUES (${scheme.lsc_id}::uuid, 1, 100, 1, 'TEST')`;

  const [member] = await prisma.$queryRaw<{ lmb_id: string }[]>`
    INSERT INTO sales.loyalty_member
      (lmb_comp_id, lmb_branch_id, lmb_acc_year, lmb_cust_id, lmb_card_no,
       lmb_enrolled_on, lmb_created_by)
    VALUES
      (${companyId}::uuid, ${branchId}::uuid, ${ACC_YEAR}::char(9), ${custId}::uuid,
       ${'TSTCONC-' + Date.now().toString(36)}, ${EARN_ON}::date, 'TEST')
    RETURNING lmb_id`;

  fixture = { companyId, branchId, custId, memberId: member.lmb_id, schemeId: scheme.lsc_id };

  // One lot of 100 points, through the service's own earn path.
  const service = new LoyaltyLedgerService(prisma as unknown as PrismaService);
  await prisma.$transaction(async (tx) => {
    await service.earn(
      tx,
      {
        docId: randomUUID(),
        accYear: ACC_YEAR,
        companyId,
        branchId,
        custId,
        docDate: EARN_ON,
        docRefno: 'TSTCONC/1',
        docType: 'SALE_BILL',
        billType: null,
        memberId: member.lmb_id,
        chargesAmt: 0,
        redeemedAmount: 0,
        lines: [
          {
            lineNo: 1,
            itemId: randomUUID(),
            unitId: null,
            qty: 1,
            grossAmt: 10_000,
            netAmt: 10_000,
            taxableAmt: 10_000,
            isFree: false,
            allowLoyalty: true,
            groupId: null,
            categoryId: null,
            brandId: null,
            sectionId: null,
          },
        ],
      },
      { memberId: member.lmb_id, createdBy: 'TEST' },
    );
  });
}, 60_000);

afterAll(async () => {
  if (fixture) {
    // Children before parents: the ledger FKs the member and the scheme.
    await prisma.$executeRaw`
      DELETE FROM sales.loyalty_ledger WHERE lld_member_id = ${fixture.memberId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM sales.loyalty_member WHERE lmb_id = ${fixture.memberId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM sales.loyalty_scheme_slab WHERE lss_lsc_id = ${fixture.schemeId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM sales.loyalty_scheme WHERE lsc_id = ${fixture.schemeId}::uuid`;
  }
  await prisma.$disconnect();
});

describe('two tills redeeming one wallet', () => {
  it('serialise on the member row — exactly one spend of 60 out of 100 succeeds', async () => {
    if (!fixture) return;
    const service = new LoyaltyLedgerService(prisma as unknown as PrismaService);
    expect(await service.balance(fixture.memberId)).toBe(100);

    // Both transactions are opened before either is allowed past the lock, so
    // they genuinely overlap rather than running one after the other.
    let arrived = 0;
    let letGo!: () => void;
    const bothOpen = new Promise<void>((r) => {
      letGo = r;
    });
    const barrier = async (): Promise<void> => {
      if (++arrived === 2) {
        letGo();
      }
      await bothOpen;
    };

    const till = (n: number) =>
      prisma.$transaction(
        async (tx) => {
          await barrier();
          return service.consume(tx, fixture!.memberId, 60, 'GIFT', {
            branchId: fixture!.branchId,
            accYear: ACC_YEAR,
            txnDate: SPEND_ON,
            srcModule: 'SALES',
            srcDocType: 'GIFT_REDEEM',
            srcDocId: randomUUID(),
            srcAccYear: ACC_YEAR,
            remarks: `till ${n}`,
            createdBy: 'TEST',
          });
        },
        { timeout: 30_000, maxWait: 30_000 },
      );

    const results = await Promise.allSettled([till(1), till(2)]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');

    // Exactly one. Two winners would mean the lock did not hold.
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    // And the loser was refused for the RIGHT reason: it re-read the balance
    // after the winner committed and found 40, not the 100 it started from.
    const reason = lost[0];
    const message = String(
      (reason.reason as { response?: { errors?: { message: string }[] } })?.response?.errors?.[0]
        ?.message ?? (reason.reason as Error)?.message,
    );
    expect(message).toMatch(/40 redeemable points/);

    // The wallet landed at 40 and never went negative — which is the whole
    // point. With SKIP LOCKED it would read -20 here.
    expect(await service.balance(fixture.memberId)).toBe(40);
    expect(await service.redeemable(fixture.memberId, SPEND_ON)).toBe(40);
  }, 60_000);
});
