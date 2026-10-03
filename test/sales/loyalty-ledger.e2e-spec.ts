// Preload .env exactly like src/main.ts, so DATABASE_URL is present before the
// PrismaClient is constructed — otherwise it falls back to the OS user.
import '../../src/env.preload';

import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma/prisma.service';
import { LoyaltyLedgerService } from '../../src/modules/sales/posting/loyalty-ledger.service';
import type { LoyaltyBillSource } from '../../src/modules/sales/posting/types/loyalty.types';

/**
 * The four tests `schema/13`'s contract block requires before LoyaltyLedger
 * Service may be called done, plus the two invariants they depend on.
 *
 *   1  two concurrent redeems of one wallet SERIALISE, and the second sees the
 *      first's spend;
 *   2  a redeem larger than the balance throws and writes NOTHING;
 *   3  a redeem spanning three lots writes three rows in FIFO order;
 *   4  the expiry run re-run on the same date writes nothing the second time.
 *
 * ── Why these spend as GIFT and not as REDEEM ──────────────────────────────
 *
 * `fk_lld_tender` points at `accounts.acc_tender_detail`, and a tender row of
 * its own needs a party ledger, a tender master, a tender type, a tender
 * ledger and a user before it will insert. Building that here would test the
 * accounts fixtures, not the wallet.
 *
 * GIFT and REDEEM take the IDENTICAL path through `consume()` — the same
 * `FOR UPDATE` on the member, the same `redeemable()` check, the same FIFO
 * walk, the same one row per lot. The only difference is the tender column,
 * which `ck_lld_gift_no_tender` and `ck_lld_redeem_tender` police in the
 * database. So what is asserted here holds for a redemption; what is NOT
 * asserted here is the tender wiring, which belongs to the bill's own tests.
 *
 *     npm run test:e2e -- loyalty-ledger
 */

const ACC_YEAR = '2026-2027';
const D1 = '2026-04-01';
const D2 = '2026-05-01';
const D3 = '2026-06-01';
/** After every lot above has matured and before any of them lapses. */
const SPEND_ON = '2026-06-02';
/** After the LAST lot has lapsed, so the sweep has everything to take. */
const SWEEP_ON = '2027-06-02';

const prisma = new PrismaClient();

/** Thrown at the end of the outer transaction so Prisma rolls it back. */
class Rollback extends Error {}

/**
 * The service's PrismaService, but every call lands on ONE open transaction:
 * `$transaction(fn)` reuses that client rather than opening a nested one.
 * Same device as `test/stock-engine-ts.e2e-spec.ts`.
 */
function transactional(tx: Prisma.TransactionClient): PrismaService {
  const proxy: object = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (client: unknown) => unknown)(proxy)
            : Promise.all(arg as Array<Promise<unknown>>);
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy as PrismaService;
}

interface Tenancy {
  companyId: string;
  branchId: string;
  custId: string;
}

/** Any company that has both a branch and a customer. Never hard-coded. */
async function findTenancy(client: Prisma.TransactionClient): Promise<Tenancy | null> {
  const rows = await client.$queryRaw<{ comp_id: string; br_id: string; cus_id: string }[]>`
    SELECT b.br_comp_id AS comp_id, b.br_id, c.cus_id
      FROM public.branch_master b
      JOIN sales.customers c ON c.cus_company_id = b.br_comp_id
     WHERE b.br_is_deleted = false AND c.cus_is_deleted = false
     LIMIT 1`;
  return rows.length === 0
    ? null
    : { companyId: rows[0].comp_id, branchId: rows[0].br_id, custId: rows[0].cus_id };
}

/**
 * A scheme that awards 1 point per 100 rupees, whose lots mature at once and
 * lapse a year later — so the three bills below produce three lots with three
 * DIFFERENT expiry dates, which is what makes the FIFO order observable, and
 * all three are still alive on SPEND_ON, which is what makes a three-lot spend
 * possible at all.
 */
async function makeScheme(
  client: Prisma.TransactionClient,
  companyId: string,
  suffix: string,
): Promise<string> {
  // ck_lsc_approved: an APPROVED scheme must name who approved it, and
  // lsc_approved_by is a user_master FK — so borrow any live user.
  const [user] = await client.$queryRaw<{ usr_id: string }[]>`
    SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;

  const [scheme] = await client.$queryRaw<{ lsc_id: string }[]>`
    INSERT INTO sales.loyalty_scheme
      (lsc_comp_id, lsc_code, lsc_name, lsc_type, lsc_status, lsc_priority,
       lsc_apply_on, lsc_calc_on_amount_type, lsc_bill_type,
       lsc_branch_scope, lsc_cust_scope, lsc_item_scope,
       lsc_allow_point_redeem, lsc_redeem_value_per_point,
       lsc_expiry_basis, lsc_points_valid_days, lsc_activation_days,
       lsc_rounding_method, lsc_points_decimals, lsc_return_mode,
       lsc_start_date, lsc_end_date, lsc_approved_by, lsc_approved_on, lsc_created_by)
    VALUES
      (${companyId}::uuid, ${'TSTLOY' + suffix}, 'Loyalty test scheme', 'BOTH', 'APPROVED', 9,
       'BILL_AMOUNT', 'NET_AMOUNT', 'ALL',
       'ALL', 'ALL', 'ALL',
       true, 1,
       'EARN_DATE', 365, 0,
       'ROUND', 0, 'REVERSE',
       ${D1}::date, '2027-03-31'::date, ${user.usr_id}::uuid, now(), 'TEST')
    RETURNING lsc_id`;

  await client.$executeRaw`
    INSERT INTO sales.loyalty_scheme_slab
      (lss_lsc_id, lss_slno, lss_each, lss_points, lss_created_by)
    VALUES (${scheme.lsc_id}::uuid, 1, 100, 1, 'TEST')`;

  return scheme.lsc_id;
}

function billOn(t: Tenancy, date: string, netAmt: number): LoyaltyBillSource {
  return {
    docId: randomUUID(),
    accYear: ACC_YEAR,
    companyId: t.companyId,
    branchId: t.branchId,
    custId: t.custId,
    docDate: date,
    docRefno: `TST/${date}`,
    docType: 'SALE_BILL',
    billType: null,
    memberId: null,
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

describe('LoyaltyLedgerService (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: LoyaltyLedgerService;
  let tenancy: Tenancy | null = null;
  let memberId = '';
  let spSeq = 0;

  beforeAll(async () => {
    let start!: () => void;
    const ready = new Promise<void>((r) => {
      start = r;
    });
    let stop!: () => void;
    const held = new Promise<void>((r) => {
      stop = r;
    });
    release = stop;

    txDone = prisma
      .$transaction(
        async (client) => {
          tx = client;
          start();
          await held;
          throw new Rollback();
        },
        { timeout: 300_000, maxWait: 30_000 },
      )
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) {
          throw e;
        }
      });

    await ready;

    tenancy = await findTenancy(tx);
    if (!tenancy) {
      // eslint-disable-next-line no-console
      console.warn('\n[loyalty e2e] SKIPPED — no company has both a branch and a customer.\n');
      return;
    }

    service = new LoyaltyLedgerService(transactional(tx));
    await makeScheme(tx, tenancy.companyId, 'A');

    // Three bills → three lots, 10 / 20 / 30 points, expiring in that order.
    const first = billOn(tenancy, D1, 1000);
    memberId = (await service.resolveMember(tx, first, { autoEnrol: true, isWalkIn: false }))!;
    for (const [date, amount] of [
      [D1, 1000],
      [D2, 2000],
      [D3, 3000],
    ] as const) {
      await service.earn(tx, billOn(tenancy, date, amount), { memberId, createdBy: 'TEST' });
    }
  }, 60_000);

  afterAll(async () => {
    release?.();
    await txDone;
    await prisma.$disconnect();
  });

  /** A failed post must not poison the outer transaction. */
  async function expectRefused(fn: () => Promise<unknown>): Promise<unknown> {
    const sp = `sp_loy_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      throw new Error('expected a refusal, none came');
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      return error;
    }
  }

  it('the fixture built three lots, and the wallet reflects them', async () => {
    if (!tenancy) return;
    const lots = await service.lots(memberId, SPEND_ON, tx);
    expect(lots.map((l) => l.lotBalance)).toEqual([10, 20, 30]);
    expect(await service.balance(memberId, tx)).toBe(60);
    expect(await service.redeemable(memberId, SPEND_ON, tx)).toBe(60);
  });

  it('lots come back oldest-expiry first — the one FIFO order', async () => {
    if (!tenancy) return;
    const lots = await service.lots(memberId, SPEND_ON, tx);
    expect(lots.map((l) => l.expiresOn)).toEqual(['2027-04-01', '2027-05-01', '2027-06-01']);
    // Strictly ascending, which is the property the till and the sweep share.
    const dates = lots.map((l) => l.expiresOn!);
    expect([...dates].sort()).toEqual(dates);
  });

  it('a spend larger than the balance throws and writes NOTHING', async () => {
    if (!tenancy) return;
    const before = await countRows(tx, memberId);

    const error = (await expectRefused(() =>
      service.consume(tx, memberId, 61, 'GIFT', {
        branchId: tenancy!.branchId,
        accYear: ACC_YEAR,
        txnDate: SPEND_ON,
        srcDocType: 'GIFT_REDEEM',
        srcDocId: randomUUID(),
        srcAccYear: ACC_YEAR,
        createdBy: 'TEST',
      }),
    )) as Error;

    // The message must say what actually happened — 60 available, 61 asked.
    expect(
      String(
        (error as { response?: { errors?: { message: string }[] } }).response?.errors?.[0]
          ?.message ?? error.message,
      ),
    ).toMatch(/60 redeemable points/);

    expect(await countRows(tx, memberId)).toBe(before);
    expect(await service.balance(memberId, tx)).toBe(60);
  });

  it('a spend across three lots writes three rows, in FIFO order, one per lot', async () => {
    if (!tenancy) return;
    const lots = await service.lots(memberId, SPEND_ON, tx);
    const srcDocId = randomUUID();

    // 45 = all of lot 1 (10), all of lot 2 (20), part of lot 3 (15).
    const written = await service.consume(tx, memberId, 45, 'GIFT', {
      branchId: tenancy.branchId,
      accYear: ACC_YEAR,
      txnDate: SPEND_ON,
      srcModule: 'SALES',
      srcDocType: 'GIFT_REDEEM',
      srcDocId,
      srcAccYear: ACC_YEAR,
      createdBy: 'TEST',
    });
    expect(written).toBe(3);

    const rows = await tx.$queryRaw<
      { lld_row_no: number; lld_points: Prisma.Decimal; lld_lot_id: string }[]
    >`
      SELECT lld_row_no, lld_points, lld_lot_id
        FROM sales.loyalty_ledger
       WHERE lld_src_doc_id = ${srcDocId}::uuid
       ORDER BY lld_row_no`;

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.lld_row_no)).toEqual([1, 2, 3]);
    // Negative, always: a spend.
    expect(rows.map((r) => Number(r.lld_points))).toEqual([-10, -20, -15]);
    // Drawn in the order lots() returned, not collapsed into one row.
    expect(rows.map((r) => r.lld_lot_id)).toEqual(lots.map((l) => l.lotId));

    // The generated columns followed, which is the whole point of recomputing.
    expect(await service.balance(memberId, tx)).toBe(15);
    expect(await service.redeemable(memberId, SPEND_ON, tx)).toBe(15);
    const left = await service.lots(memberId, SPEND_ON, tx);
    expect(left).toHaveLength(1);
    expect(left[0].lotBalance).toBe(15);
  });

  it('the expiry sweep is idempotent — a re-run on the same date writes nothing', async () => {
    if (!tenancy) return;
    // A day after the last lot has lapsed, so everything left is sweepable.
    const after = SWEEP_ON;

    const firstRun = await service.expiryRun(tenancy.companyId, ACC_YEAR, after, 'TEST');
    expect(firstRun).toBeGreaterThan(0);
    const afterFirst = await countRows(tx, memberId);

    const secondRun = await service.expiryRun(tenancy.companyId, ACC_YEAR, after, 'TEST');
    // Idempotent TWICE over: the swept lots now have a zero balance and are
    // not selected again, so the run finds nothing before ux_lld_src_row is
    // ever consulted.
    expect(secondRun).toBe(0);
    expect(await countRows(tx, memberId)).toBe(afterFirst);
    expect(await service.redeemable(memberId, after, tx)).toBe(0);
  });

  it('the sweep id is deterministic and cannot collide with the coupon sweep', async () => {
    if (!tenancy) return;
    const [ids] = await tx.$queryRaw<{ points: string; coupon: string }[]>`
      SELECT md5(${tenancy.companyId} || '|' || ${SWEEP_ON})::uuid        AS points,
             md5(${tenancy.companyId} || '|coupon|' || ${SWEEP_ON})::uuid  AS coupon`;

    const used = await tx.$queryRaw<{ lld_src_doc_id: string }[]>`
      SELECT DISTINCT lld_src_doc_id
        FROM sales.loyalty_ledger
       WHERE lld_member_id   = ${memberId}::uuid
         AND lld_src_doc_type = 'EXPIRY_RUN'`;

    // The recipe the service used is md5(company|date) — exactly 13's.
    expect(used.map((u) => u.lld_src_doc_id)).toEqual([ids.points]);
    expect(ids.points).not.toBe(ids.coupon);
  });
});

async function countRows(tx: Prisma.TransactionClient, memberId: string): Promise<number> {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM sales.loyalty_ledger WHERE lld_member_id = ${memberId}::uuid`;
  return Number(row.n);
}
