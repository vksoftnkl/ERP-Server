import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { LoyaltyLedgerService } from '../../sales/posting/loyalty-ledger.service';
import { LOYALTY_LOT_TXN_TYPES } from '../../sales/posting/types/loyalty.types';
import { LOYALTY_STATUS_MENU_ID, LoyaltyStatusService } from './loyalty-status.service';
import { LOYALTY_STATUS_ERROR } from './types/loyalty-status.types';

const TODAY = '2026-10-21';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const SCHEME_ID = '019c6f6c-be87-7a11-8905-36092c46b005';
const MEMBER_ID = '019c6f6c-be87-7a11-8905-36092c46b006';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46b007';
const GIFT_ID = '019c6f6c-be87-7a11-8905-36092c46b008';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b009';

const D = (v: string | number) => new Prisma.Decimal(v);

// ── the fake database ───────────────────────────────────────────────────────
// Every $queryRaw is a tagged template; rebuilding it with Prisma.sql gives the
// exact SQL text (with `?` placeholders) and the flattened bound values, so a
// test can route on the text and assert what was bound.

interface Call {
  sql: string;
  values: unknown[];
}

const memberRow = (overrides: Record<string, unknown> = {}) => ({
  member_id: MEMBER_ID,
  cust_id: CUST_ID,
  card_no: 'LC-0001',
  customer_name: 'Ravi Stores',
  mobile: '9876543210',
  lsc_id: SCHEME_ID,
  scheme_name: 'Gold',
  status: 'ACTIVE',
  earned: D(500),
  bills: 12n,
  redeemed: D(200),
  expired: D(20),
  gift: D(100),
  adjusted: D(-30),
  balance: D(150),
  redeemable: D(120),
  cooling: D(20),
  lapsed: D(10),
  lotted: D(150),
  next_expiry_on: '2026-11-01',
  next_expiry_points: D(40),
  priced_value: D('60.0000'),
  priced_points: D(120),
  expiring30: D(40),
  ms_rate: D('0.5'),
  lsg_id: null,
  lsg_item_id: null,
  gift_name: null,
  gift_points: null,
  lsg_repeat: null,
  lsg_max_qty_per_bill: null,
  eligible: false,
  last_activity_on: '2026-10-20',
  enrolled_on: '2025-04-01',
  branch_id: BRANCH_ID,
  branch_name: 'Main',
  lifetime_bill_amt: D('12345.5'),
  lifetime_bill_cnt: 12,
  last_earn_on: '2026-10-20',
  last_redeem_on: '2026-09-01',
  block_reason: null,
  rule_allow_point: true,
  rule_allow_gift: true,
  rule_rate: D('0.5'),
  rule_min: D(100),
  rule_max: D(1000),
  rule_multiple: D(10),
  rule_max_perc: D(50),
  rule_activation_days: 7,
  rule_valid_days: 365,
  ...overrides,
});

const summaryRow = (overrides: Record<string, unknown> = {}) => ({
  members: 3n,
  active: 2n,
  suspended: 1n,
  outstanding: D('450.5'),
  outstanding_value: D('180.256'),
  earned: D(900),
  bills: 30n,
  gift_eligible: 1n,
  expiring30_points: D(70),
  expiring30_members: 2n,
  redeemed: D(300),
  redeemed_value: D('150.5'),
  gifts_low: 1n,
  ...overrides,
});

const statementRow = (
  id: string,
  date: string,
  points: number,
  running: number,
  overrides: Record<string, unknown> = {},
) => ({
  lld_id: id,
  lld_acc_year: '2026-2027',
  txn_date: date,
  txn_time: '10:00:00',
  lld_txn_type: 'EARN',
  lld_src_doc_type: 'SALE_BILL',
  lld_src_doc_id: `doc-${id}`,
  lld_src_acc_year: '2026-2027',
  lld_src_doc_refno: `SB-${id}`,
  lld_lsc_id: SCHEME_ID,
  lsc_name: 'Gold',
  lld_remarks: null,
  lld_base_amount: D('1000'),
  lld_points: D(points),
  lld_money_value: D(0),
  expires_on: '2027-10-21',
  active_from: null,
  lld_reversal_of_id: null,
  lld_reversal_reason: null,
  lld_lot_id: null,
  approver: null,
  running: D(running),
  ...overrides,
});

const lotRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  lld_id: id,
  lld_acc_year: '2026-2027',
  lld_txn_type: 'EARN',
  txn_date: '2026-09-01',
  lld_src_doc_refno: `SB-${id}`,
  lld_lsc_id: SCHEME_ID,
  lld_points: D(100),
  lld_consumed_points: D(40),
  lld_lot_balance: D(60),
  expires_on: '2027-09-01',
  active_from: '2026-09-08',
  ...overrides,
});

const expiringRow = (overrides: Record<string, unknown> = {}) => ({
  member_id: MEMBER_ID,
  cust_id: CUST_ID,
  customer_name: 'Ravi Stores',
  card_no: 'LC-0001',
  mobile: '9876543210',
  lsc_id: SCHEME_ID,
  scheme_name: 'Gold',
  status: 'ACTIVE',
  expires_on: '2026-10-25',
  days_left: 4,
  points: D('40.5'),
  priced_value: D('20.25'),
  priced_points: D('40.5'),
  balance: D(150),
  last_activity_on: '2026-10-20',
  branch_id: BRANCH_ID,
  branch_name: 'Main',
  total_rows: 7n,
  ...overrides,
});

const schemeRow = (overrides: Record<string, unknown> = {}) => ({
  lsc_id: SCHEME_ID,
  lsc_name: 'Gold',
  lsc_code: 'GOLD',
  lsc_status: 'APPROVED',
  lsc_is_active: true,
  lsc_is_deleted: false,
  start_date: '2026-04-01',
  end_date: null,
  lsc_allow_point_redeem: true,
  lsc_redeem_value_per_point: D('0.5'),
  branch_id: null,
  branch_name: null,
  month: null,
  opening: D(100),
  outstanding: D(250),
  earned: D(400),
  redeemed: D(150),
  gift: D(50),
  expired: D(20),
  adjusted: D(-30),
  bills: 9n,
  ...overrides,
});

/** The members page. The summary's `red` CTE reads `FROM filtered f` too; only the page counts total_rows. */
const MEMBER_PAGE = ['FROM filtered f', 'AS total_rows'];

class FakeDb {
  calls: Call[] = [];
  rights: Record<string, boolean> | null = {
    um_can_view: true,
    um_can_print: true,
    um_can_export: true,
  };
  branchComp: string | null = COMPANY_ID;
  schemeComp: string | null = COMPANY_ID;
  memberExists = true;
  memberPage: unknown[] = [];
  memberSummary: unknown = summaryRow();
  memberBase: unknown[] = [memberRow()];
  lots: unknown[] = [];
  statement: unknown[] = [];
  expiringPage: unknown[] = [];
  expiringSummary: Record<string, unknown> = {
    p0: D(10),
    m0: 1n,
    p1: D(20),
    m1: 2n,
    p2: D(30),
    m2: 3n,
    value_at_risk: D('30.5'),
    points: D(60),
    members: 4n,
  };
  calendar: unknown[] = [];
  schemes: unknown[] = [];
  holders: unknown[] = [];
  validTill: unknown[] = [];
  monthly: unknown[] = [];
  schemeName: unknown[] = [{ lsc_name: 'Gold' }];
  gifts: unknown[] = [];
  company: unknown[] = [{ comp_name: 'Zeta Traders' }];
  branch: unknown[] = [{ br_name: 'Main' }];
  card: unknown[] = [{ card_no: 'LC-0001', cus_name: 'Ravi Stores' }];

  readonly $queryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const built = Prisma.sql(strings, ...(values as Prisma.Sql[]));
    const call = { sql: built.sql, values: built.values };
    this.calls.push(call);
    return this.respond(call.sql);
  });

  private respond(sql: string): unknown[] {
    if (sql.includes('CURRENT_DATE::text AS d')) return [{ d: TODAY }];
    if (sql.includes('FROM public.user_menus')) return this.rights ? [this.rights] : [];
    if (sql.includes('SELECT br_comp_id')) {
      return this.branchComp === null ? [] : [{ br_comp_id: this.branchComp }];
    }
    if (sql.includes('SELECT lsc_comp_id')) {
      return this.schemeComp === null ? [] : [{ lsc_comp_id: this.schemeComp }];
    }
    if (sql.includes('SELECT true AS ok')) return this.memberExists ? [{ ok: true }] : [];
    if (sql.includes('WITH rows AS')) return this.statement;
    if (sql.includes('lld_consumed_points')) return this.lots;
    if (sql.includes('agg AS')) return [this.memberSummary];
    if (sql.includes('FROM filtered f')) return this.memberPage;
    if (sql.includes('value_at_risk')) return [this.expiringSummary];
    if (sql.includes('FROM base f')) return this.expiringPage;
    if (sql.includes("interval '7 days'")) return this.calendar;
    if (sql.includes("interval '1 month'")) return this.monthly;
    if (sql.includes('WITH mv AS')) return this.schemes;
    if (sql.includes('AS holders')) return this.holders;
    if (sql.includes('AS valid_till')) return this.validTill;
    if (sql.includes('eligible_members')) return this.gifts;
    if (sql.includes('SELECT lsc_name FROM sales.loyalty_scheme')) return this.schemeName;
    if (sql.includes('FROM public.companys')) return this.company;
    if (sql.includes('SELECT br_name FROM')) return this.branch;
    if (sql.includes('lmb_card_no AS card_no')) return this.card;
    if (sql.includes('AS member_id')) return this.memberBase;
    throw new Error(`unexpected query: ${sql.slice(0, 120)}`);
  }

  /** The one call whose SQL holds every one of `fragments`. */
  callWith(...fragments: string[]): Call {
    const found = this.calls.filter((c) => fragments.every((f) => c.sql.includes(f)));
    if (found.length !== 1) {
      throw new Error(`expected one query with "${fragments.join('" + "')}", saw ${found.length}`);
    }
    return found[0];
  }

  ran(fragment: string): boolean {
    return this.calls.some((c) => c.sql.includes(fragment));
  }
}

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const refusedBody = (code: string, field: string, message: string) => ({
  success: false,
  message: 'Loyalty status request refused',
  errors: [{ field, message, code }],
});

const PERIOD = { companyId: COMPANY_ID, from: '2026-04-01', to: '2026-10-21' };

describe('LoyaltyStatusService', () => {
  let db: FakeDb;
  let ledger: { redeemable: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: LoyaltyStatusService;

  beforeEach(() => {
    db = new FakeDb();
    ledger = { redeemable: jest.fn().mockResolvedValue(95) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new LoyaltyStatusService(
      db as unknown as PrismaService,
      context as never,
      ledger as unknown as LoyaltyLedgerService,
    );
  });

  // Dates leave Node as 'YYYY-MM-DD' text cast ::date — a JS Date bound as
  // timestamptz is off by 5h30 in the IST session (memory: db-session-timezone-ist).
  afterEach(() => {
    const bound = db.calls.flatMap((c) => c.values);
    expect(bound.some((v) => v instanceof Date)).toBe(false);
  });

  // ── rights (menu 79, prefix LST) ──────────────────────────────────────────
  describe('rights', () => {
    const viewRoutes: Array<[string, () => Promise<unknown>]> = [
      ['members', () => service.members({ companyId: COMPANY_ID })],
      ['statement', () => service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID })],
      ['member', () => service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID })],
      ['expiring', () => service.expiring({ companyId: COMPANY_ID })],
      ['calendar', () => service.calendar({ companyId: COMPANY_ID })],
      ['schemes', () => service.schemes(PERIOD)],
      ['monthly', () => service.monthly({ ...PERIOD, lscId: SCHEME_ID })],
      ['gifts', () => service.gifts({ ...PERIOD, lscId: SCHEME_ID })],
    ];

    it.each(viewRoutes)('%s refuses a user without view on menu 79, reading nothing else', async (_name, call) => {
      db.rights = { um_can_view: false };

      const refusal = await refusalOf(call());

      const message =
        'This user may not view the Loyalty Status (menu 79: um_can_view is not granted)';
      expect(refusal).toEqual({
        status: 403,
        body: {
          success: false,
          message,
          errors: [{ field: 'userId', message, code: 'LST_RIGHT_VIEW' }],
        },
      });
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].values).toEqual([USER_ID, LOYALTY_STATUS_MENU_ID]);
    });

    it('refuses a request with no logged-in user without reading user_menus', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(service.members({ companyId: COMPANY_ID }));

      expect(refusal.status).toBe(403);
      expect(db.calls).toHaveLength(0);
    });

    it('refuses a user with no user_menus row at all', async () => {
      db.rights = null;

      const refusal = await refusalOf(service.calendar({ companyId: COMPANY_ID }));

      expect(refusal).toMatchObject({ status: 403, body: { errors: [{ code: 'LST_RIGHT_VIEW' }] } });
    });

    it.each([
      ['a pdf (the default) needs print', undefined, 'um_can_print', 'LST_RIGHT_PRINT'],
      ['an xlsx needs export', 'xlsx' as const, 'um_can_export', 'LST_RIGHT_EXPORT'],
    ])('export: %s', async (_label, format, column, code) => {
      db.rights = { um_can_view: true, um_can_print: false, um_can_export: false };

      const refusal = await refusalOf(
        service.export({ companyId: COMPANY_ID, tab: 'members', format }),
      );

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code, message: expect.stringContaining(column) }] },
      });
    });
  });

  // ── scope ─────────────────────────────────────────────────────────────────
  describe('scope', () => {
    it.each([
      ['another company', OTHER_COMPANY_ID],
      ['no company (no such branch)', null],
    ])('refuses a branch of %s', async (_label, branchComp) => {
      db.branchComp = branchComp;

      const refusal = await refusalOf(
        service.members({ companyId: COMPANY_ID, branchId: BRANCH_ID }),
      );

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(
          LOYALTY_STATUS_ERROR.BRANCH_NOT_IN_COMPANY,
          'branchId',
          'This branch does not belong to the company.',
        ),
      });
      expect(db.ran('FROM filtered f')).toBe(false);
    });

    it.each([
      ['another company', OTHER_COMPANY_ID],
      ['no company (no such scheme)', null],
    ])('refuses a scheme of %s', async (_label, schemeComp) => {
      db.schemeComp = schemeComp;

      const refusal = await refusalOf(
        service.expiring({ companyId: COMPANY_ID, lscId: SCHEME_ID }),
      );

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(
          LOYALTY_STATUS_ERROR.SCHEME_NOT_IN_COMPANY,
          'lscId',
          'This scheme does not belong to the company.',
        ),
      });
    });

    it("takes today from the database session, not the Node clock, and answers it as asOn", async () => {
      const result = await service.calendar({ companyId: COMPANY_ID });

      expect(result.asOn).toBe(TODAY);
      expect(db.callWith("interval '7 days'").values).toContain(TODAY);
    });
  });

  // ── §5.1 members ──────────────────────────────────────────────────────────
  describe('members', () => {
    it('pages 50 rows from the start by default, sorted by customer name', async () => {
      db.memberPage = [{ ...memberRow(), total_rows: 7n }];

      const result = await service.members({ companyId: COMPANY_ID });

      const page = db.callWith(...MEMBER_PAGE);
      expect(page.sql).toContain('ORDER BY f.customer_name ASC NULLS LAST, f.member_id');
      expect(page.values.slice(-2)).toEqual([50, 0]);
      expect(result).toMatchObject({ asOn: TODAY, total: 7 });
      expect(result.items).toHaveLength(1);
    });

    it('skips the rows of the earlier pages and sorts by the mapped column', async () => {
      await service.members({
        companyId: COMPANY_ID,
        page: 3,
        limit: 20,
        sort: 'value',
        order: 'desc',
      });

      const page = db.callWith(...MEMBER_PAGE);
      expect(page.sql).toContain('ORDER BY f.priced_value DESC NULLS LAST');
      expect(page.values.slice(-2)).toEqual([20, 40]);
    });

    it('answers a total of 0 on an empty page', async () => {
      await expect(service.members({ companyId: COMPANY_ID })).resolves.toMatchObject({
        items: [],
        total: 0,
      });
    });

    it('refuses a sort key the grid does not have', async () => {
      const refusal = await refusalOf(service.members({ companyId: COMPANY_ID, sort: 'points' }));

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.BAD_SORT, 'sort', 'Unknown sort key "points".'),
      });
    });

    it.each([
      ['ACTIVE and SUSPENDED when nothing is said', {}, ['ACTIVE', 'SUSPENDED']],
      [
        'every status with includeMergedClosed',
        { includeMergedClosed: true },
        ['ACTIVE', 'SUSPENDED', 'CLOSED', 'MERGED'],
      ],
      ['exactly the status named', { status: 'CLOSED' as const, includeMergedClosed: true }, ['CLOSED']],
    ])('lists %s', async (_label, filters, statuses) => {
      await service.members({ companyId: COMPANY_ID, ...filters });

      expect(db.callWith(...MEMBER_PAGE).values).toContainEqual(statuses);
    });

    it('keeps only wallets with a balance by default, and every wallet when told', async () => {
      await service.members({ companyId: COMPANY_ID });
      const byDefault = db.callWith(...MEMBER_PAGE).sql;
      db.calls = [];
      await service.members({ companyId: COMPANY_ID, balanceGtZero: false });
      const all = db.callWith(...MEMBER_PAGE).sql;

      expect(byDefault).toContain('WHERE TRUE AND balance > 0');
      expect(all).toContain('WHERE TRUE)');
    });

    it('narrows to eligible wallets and a balance band on the filtered set', async () => {
      await service.members({
        companyId: COMPANY_ID,
        eligibleOnly: true,
        pointsMin: 100,
        pointsMax: 500,
      });

      const page = db.callWith(...MEMBER_PAGE);
      expect(page.sql).toContain(
        'WHERE TRUE AND balance > 0 AND eligible AND balance >= ?::numeric AND balance <= ?::numeric',
      );
      expect(page.values).toEqual(expect.arrayContaining([100, 500]));
    });

    it('filters the scheme and the home branch, and binds the open-lot types from the shared constant', async () => {
      await service.members({ companyId: COMPANY_ID, branchId: BRANCH_ID, lscId: SCHEME_ID });

      const page = db.callWith(...MEMBER_PAGE);
      expect(page.sql).toContain('m.lmb_branch_id = ?::uuid');
      expect(page.sql).toContain('m.lmb_lsc_id = ?::uuid');
      expect(page.values).toContainEqual([...LOYALTY_LOT_TXN_TYPES]);
      expect([...LOYALTY_LOT_TXN_TYPES]).toEqual(['EARN', 'OPENING', 'ADJUST', 'TRANSFER']);
    });

    it('searches card, mobile and name loosely, one group per word', async () => {
      await service.members({ companyId: COMPANY_ID, search: 'ravi 98765' });

      const page = db.callWith(...MEMBER_PAGE);
      expect(page.sql).toContain('fixed.fn_search_norm(m.lmb_card_no)');
      expect(page.sql).toContain('fixed.fn_search_norm(c.cus_name)');
      expect(page.values).toEqual(expect.arrayContaining(['ravi', '98765']));
    });

    it('reads lifetime earned from the wallet when no period is sent', async () => {
      await service.members({ companyId: COMPANY_ID });

      const page = db.callWith(...MEMBER_PAGE);
      expect(page.sql).toContain('m.lmb_earned_points AS earned');
      expect(page.sql).not.toContain("l.lld_txn_type IN ('EARN', 'OPENING')\n");
    });

    it('sums EARN and OPENING in the period when both ends are sent, for the rows and the tiles', async () => {
      await service.members({
        companyId: COMPANY_ID,
        earnedFrom: '2026-04-01',
        earnedTo: '2026-10-21',
      });

      for (const fragments of [MEMBER_PAGE, ['agg AS']]) {
        const call = db.callWith(...fragments);
        expect(call.sql).toContain("l.lld_txn_type IN ('EARN', 'OPENING')");
        expect(call.values).toEqual(expect.arrayContaining(['2026-04-01', '2026-10-21']));
      }
    });

    it.each([
      [{ earnedFrom: '2026-04-01' }, 'earnedFrom and earnedTo go together.'],
      [{ earnedTo: '2026-10-21' }, 'earnedFrom and earnedTo go together.'],
      [{ earnedFrom: '2026-10-21', earnedTo: '2026-04-01' }, '2026-10-21 is after 2026-04-01.'],
    ])('refuses an earned period of %o', async (period, message) => {
      const refusal = await refusalOf(service.members({ companyId: COMPANY_ID, ...period }));

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.RANGE_REVERSED, 'earnedFrom', message),
      });
    });

    it('maps a wallet: points as numbers, value as two-decimal text', async () => {
      db.memberPage = [{ ...memberRow(), total_rows: 1n }];

      const {
        items: [item],
      } = await service.members({ companyId: COMPANY_ID });

      expect(item).toEqual({
        memberId: MEMBER_ID,
        custId: CUST_ID,
        cardNo: 'LC-0001',
        customerName: 'Ravi Stores',
        mobile: '9876543210',
        lscId: SCHEME_ID,
        schemeName: 'Gold',
        status: 'ACTIVE',
        earned: 500,
        redeemed: 200,
        expired: 20,
        gift: 100,
        adjusted: -30,
        balance: 150,
        redeemable: 120,
        cooling: 20,
        lapsed: 10,
        value: '60.00',
        nextExpiryOn: '2026-11-01',
        nextExpiryPoints: 40,
        bestGift: null,
        eligible: false,
        lastActivityOn: '2026-10-20',
        enrolledOn: '2025-04-01',
        branchId: BRANCH_ID,
        branchName: 'Main',
      });
    });

    // value ₹ (§4, D4)
    it.each([
      ['the priced redeemable lots', { redeemable: D(120), priced_points: D(120), priced_value: D('60.005') }, '60.01'],
      ['nothing when no redeemable lot is priced', { redeemable: D(120), priced_points: D(0) }, null],
      ['0.00 for an empty wallet on a priced scheme', { redeemable: D(0), ms_rate: D('0.5') }, '0.00'],
      ['nothing for an empty wallet on an unpriced scheme', { redeemable: D(0), ms_rate: null }, null],
    ])('values %s', async (_label, overrides, value) => {
      db.memberPage = [{ ...memberRow(overrides), total_rows: 1n }];

      const result = await service.members({ companyId: COMPANY_ID });

      expect(result.items[0].value).toBe(value);
    });

    // best gift (§4): floor(redeemable / points), capped, at least one.
    it.each([
      ['one of a gift that does not repeat', { lsg_repeat: false }, 1],
      ['as many as the redeemable points buy when it repeats', { lsg_repeat: true }, 2],
      ['no more than the per-bill cap', { lsg_repeat: true, lsg_max_qty_per_bill: D(1) }, 1],
      ['no cap when the cap is 0', { lsg_repeat: true, lsg_max_qty_per_bill: D(0) }, 2],
    ])('offers %s', async (_label, overrides, qty) => {
      db.memberPage = [
        {
          ...memberRow({
            redeemable: D(250),
            lsg_id: GIFT_ID,
            lsg_item_id: ITEM_ID,
            gift_name: 'Mixer',
            gift_points: D(100),
            eligible: true,
            ...overrides,
          }),
          total_rows: 1n,
        },
      ];

      const result = await service.members({ companyId: COMPANY_ID });

      expect(result.items[0].bestGift).toEqual({
        lsgId: GIFT_ID,
        itemId: ITEM_ID,
        name: 'Mixer',
        points: 100,
        qty,
      });
      expect(result.items[0].eligible).toBe(true);
    });

    it('offers no gift without an item, and reads a missing earned as 0', async () => {
      db.memberPage = [
        { ...memberRow({ lsg_id: GIFT_ID, lsg_item_id: null, earned: null }), total_rows: 1n },
      ];

      const result = await service.members({ companyId: COMPANY_ID });

      expect(result.items[0]).toMatchObject({ bestGift: null, earned: 0 });
    });

    it('summarises the whole filtered set, never the page', async () => {
      const result = await service.members({ companyId: COMPANY_ID, lscId: SCHEME_ID });

      expect(result.summary).toEqual({
        members: 3,
        active: 2,
        suspended: 1,
        outstanding: 450.5,
        outstandingValue: '180.26',
        earnedInPeriod: 900,
        earnedBills: 30,
        redeemedInPeriod: 300,
        redeemedValue: '150.50',
        giftEligible: 1,
        giftsLowOnStock: 1,
        expiring30Points: 70,
        expiring30Members: 2,
      });
      const summary = db.callWith('agg AS');
      // No page LIMIT / OFFSET. The base's gift lateral keeps its own LIMIT 1 (one gift per member).
      expect(summary.sql).not.toContain('LIMIT ?');
      expect(summary.sql).not.toContain('OFFSET');
      // Σ of the rows' value (notes 91 N2), not the member's scheme rate.
      expect(summary.sql).toContain('SUM(priced_value) FILTER (WHERE redeemable > 0 AND priced_points > 0)');
      expect(summary.sql).toContain("l.lld_txn_type IN ('REDEEM', 'GIFT')");
    });
  });

  // ── §5.2 statement ────────────────────────────────────────────────────────
  describe('statement', () => {
    it('refuses a member who is not a live member of the company', async () => {
      db.memberExists = false;

      const refusal = await refusalOf(
        service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID }),
      );

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Loyalty member not found',
          errors: [
            {
              field: 'memberId',
              message: `No live member ${MEMBER_ID} in this company`,
              code: LOYALTY_STATUS_ERROR.MEMBER_NOT_FOUND,
            },
          ],
        },
      });
      expect(db.ran('WITH rows AS')).toBe(false);
      expect(db.callWith('SELECT true AS ok').values).toEqual([MEMBER_ID, COMPANY_ID]);
    });

    it('runs to today from the first row when no period is sent', async () => {
      db.statement = [statementRow('a', '2026-09-01', 100, 100), statementRow('b', '2026-10-01', -30, 70)];

      const result = await service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(result).toMatchObject({ memberId: MEMBER_ID, from: null, to: TODAY, opening: 0, closing: 70 });
      expect(result.rows.map((r) => r.runningBalance)).toEqual([100, 70]);
      expect(db.callWith('WITH rows AS').values).toEqual([MEMBER_ID, TODAY, true]);
    });

    it('opens on the running balance before from, and lists the rest', async () => {
      db.statement = [
        statementRow('a', '2026-03-01', 100, 100),
        statementRow('b', '2026-03-31', 50, 150),
        statementRow('c', '2026-04-01', -40, 110),
        statementRow('d', '2026-05-01', 10, 120),
      ];

      const result = await service.statement({
        companyId: COMPANY_ID,
        memberId: MEMBER_ID,
        from: '2026-04-01',
        to: '2026-09-30',
      });

      expect(result.opening).toBe(150);
      expect(result.rows.map((r) => r.lldId)).toEqual(['c', 'd']);
      expect(result.closing).toBe(120);
    });

    it('closes on the opening when nothing moved in the period', async () => {
      db.statement = [statementRow('a', '2026-03-01', 100, 100)];

      const result = await service.statement({
        companyId: COMPANY_ID,
        memberId: MEMBER_ID,
        from: '2026-04-01',
      });

      expect(result).toMatchObject({ opening: 100, rows: [], closing: 100 });
    });

    it('passes showReversals=false into the SQL that hides both halves of a pair', async () => {
      await service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID, showReversals: false });

      const call = db.callWith('WITH rows AS');
      expect(call.values[2]).toBe(false);
      expect(call.sql).toContain('OR (lld_reversal_of_id IS NULL AND NOT is_reversed)');
    });

    it('refuses a from after the to', async () => {
      const refusal = await refusalOf(
        service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID, from: '2026-11-01' }),
      );

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.RANGE_REVERSED, 'from', `2026-11-01 is after ${TODAY}.`),
      });
    });

    it('maps a row with its base amount as two-decimal text', async () => {
      db.statement = [
        statementRow('a', '2026-10-01', -20, 80, {
          lld_txn_type: 'REDEEM',
          lld_base_amount: D('1234.5'),
          lld_reversal_of_id: 'orig',
          lld_lot_id: 'lot-1',
          expires_on: null,
          active_from: '2026-10-08',
        }),
      ];

      const { rows } = await service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(rows[0]).toEqual({
        lldId: 'a',
        accYear: '2026-2027',
        txnDate: '2026-10-01',
        txnTime: '10:00:00',
        txnType: 'REDEEM',
        srcDocType: 'SALE_BILL',
        srcDocId: 'doc-a',
        srcAccYear: '2026-2027',
        srcDocRefno: 'SB-a',
        lscId: SCHEME_ID,
        schemeName: 'Gold',
        reason: 'Reversed: Redeemed against SB-a (Gold)',
        baseAmount: '1234.50',
        points: -20,
        runningBalance: 80,
        expiresOn: null,
        activeFrom: '2026-10-08',
        isReversal: true,
        reversalOfId: 'orig',
        lotId: 'lot-1',
      });
    });

    // The reason column (§5.2), built on the server.
    it.each([
      ['the remark when there is one', { lld_remarks: 'Goodwill' }, 'Goodwill'],
      ['a reversal remark with its prefix', { lld_remarks: 'Bill returned', lld_reversal_of_id: 'x' }, 'Reversed: Bill returned'],
      ['an earn by its bill', { lld_txn_type: 'EARN' }, 'Earned on SB-a (Gold)'],
      [
        'an earn by its document type when it has no refno',
        { lld_txn_type: 'EARN', lld_src_doc_refno: null, lld_src_doc_type: 'SALE_BILL' },
        'Earned on sale bill (Gold)',
      ],
      [
        'an earn with no document at all',
        { lld_txn_type: 'EARN', lld_src_doc_refno: null, lld_src_doc_type: null, lsc_name: null },
        'Earned on bill',
      ],
      ['an opening', { lld_txn_type: 'OPENING' }, 'Opening balance (Gold)'],
      [
        'a redemption with its tender',
        { lld_txn_type: 'REDEEM', lld_money_value: D('25.5') },
        'Redeemed against SB-a (Gold) · tender ₹25.50',
      ],
      ['a gift', { lld_txn_type: 'GIFT' }, 'Gift SB-a (Gold)'],
      [
        'a gift with nothing to name',
        { lld_txn_type: 'GIFT', lld_src_doc_refno: null, lld_src_doc_type: null, lsc_name: null },
        'Gift',
      ],
      ['a lapse', { lld_txn_type: 'EXPIRE' }, 'Lapsed (Gold)'],
      ['an approved adjustment', { lld_txn_type: 'ADJUST', approver: 'Anu' }, 'Adjustment (Gold) · approved by Anu'],
      ['an adjustment nobody approved', { lld_txn_type: 'ADJUST' }, 'Adjustment (Gold)'],
      ['a transfer', { lld_txn_type: 'TRANSFER' }, 'Transfer (Gold)'],
      ['an unknown type by its name', { lld_txn_type: 'MIGRATE' }, 'MIGRATE (Gold)'],
    ])('words %s', async (_label, overrides, reason) => {
      db.statement = [statementRow('a', '2026-10-01', 10, 10, overrides)];

      const { rows } = await service.statement({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(rows[0].reason).toBe(reason);
    });
  });

  // ── §5.3 member card ──────────────────────────────────────────────────────
  describe('member', () => {
    it('refuses a member the company does not have', async () => {
      db.memberBase = [];

      const refusal = await refusalOf(service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'memberId', code: LOYALTY_STATUS_ERROR.MEMBER_NOT_FOUND }] },
      });
      expect(ledger.redeemable).not.toHaveBeenCalled();
    });

    it("headlines the till's own redeemable, not the set SQL's copy (D1)", async () => {
      const card = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(ledger.redeemable).toHaveBeenCalledWith(MEMBER_ID, TODAY);
      expect(card.redeemable).toBe(95);
      expect(db.callWith('AS member_id').values).toEqual(
        expect.arrayContaining([MEMBER_ID, COMPANY_ID]),
      );
    });

    it('lists every open lot FIFO with its state, and the earliest cooling date', async () => {
      db.lots = [
        lotRow('lapsed', { expires_on: '2026-10-20', active_from: '2025-10-20' }),
        lotRow('cool-late', { active_from: '2026-11-15', expires_on: null }),
        lotRow('ok', { active_from: null }),
        lotRow('cool-early', { active_from: '2026-10-25' }),
      ];

      const card = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(card.lots.map((l) => [l.lotId, l.state])).toEqual([
        ['lapsed', 'LAPSED'],
        ['cool-late', 'COOLING'],
        ['ok', 'REDEEMABLE'],
        ['cool-early', 'COOLING'],
      ]);
      expect(card.coolingFrom).toBe('2026-10-25');
      expect(card.lots[2]).toEqual({
        lotId: 'ok',
        accYear: '2026-2027',
        txnType: 'EARN',
        earnedOn: '2026-09-01',
        srcDocRefno: 'SB-ok',
        lscId: SCHEME_ID,
        points: 100,
        used: 40,
        left: 60,
        expiresOn: '2027-09-01',
        activeFrom: null,
        state: 'REDEEMABLE',
      });
      const lots = db.callWith('lld_consumed_points');
      expect(lots.sql).toContain('ORDER BY lld_expires_on NULLS LAST, lld_txn_date, lld_id');
      expect(lots.values).toEqual([MEMBER_ID, [...LOYALTY_LOT_TXN_TYPES]]);
    });

    it('treats a lot expiring today as still redeemable', async () => {
      db.lots = [lotRow('today', { expires_on: TODAY, active_from: TODAY })];

      const card = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(card.lots[0].state).toBe('REDEEMABLE');
      expect(card.coolingFrom).toBeNull();
    });

    it('reports the balance the lots do not account for as unlotted', async () => {
      db.memberBase = [memberRow({ balance: D('150.5') })];
      db.lots = [lotRow('a', { lld_lot_balance: D('60.25') }), lotRow('b', { lld_lot_balance: D(70) })];

      const card = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(card.unlotted).toBe(20.25);
    });

    it('answers the card, the gift, the tender value and the redeem rules', async () => {
      db.memberBase = [
        memberRow({
          lsg_id: GIFT_ID,
          lsg_item_id: ITEM_ID,
          gift_name: 'Mixer',
          gift_points: D(100),
          lsg_repeat: false,
          eligible: true,
        }),
      ];

      const card = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(card).toMatchObject({
        asOn: TODAY,
        card: {
          memberId: MEMBER_ID,
          custId: CUST_ID,
          lifetimeBillAmt: '12345.50',
          lifetimeBillCnt: 12,
          lastEarnOn: '2026-10-20',
          lastRedeemOn: '2026-09-01',
          status: 'ACTIVE',
          blockReason: null,
          lscId: SCHEME_ID,
          branchName: 'Main',
        },
        balance: 150,
        cooling: 20,
        lapsed: 10,
        bestGift: { lsgId: GIFT_ID, qty: 1 },
        eligible: true,
        tenderValue: '60.00',
        rules: {
          allowPointRedeem: true,
          allowGiftRedeem: true,
          redeemValuePerPoint: '0.5000',
          minRedeemPoints: 100,
          maxRedeemPoints: 1000,
          redeemMultiple: 10,
          maxRedeemPerc: 50,
          activationDays: 7,
          pointsValidDays: 365,
        },
      });
    });

    it('has no rules for a wallet with no scheme, and no rate for a scheme that prices nothing', async () => {
      db.memberBase = [memberRow({ lsc_id: null })];
      const unhomed = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });
      db.memberBase = [
        memberRow({
          rule_rate: null,
          rule_min: null,
          rule_activation_days: null,
          rule_valid_days: null,
          lifetime_bill_cnt: null,
        }),
      ];
      const unpriced = await service.member({ companyId: COMPANY_ID, memberId: MEMBER_ID });

      expect(unhomed.rules).toBeNull();
      expect(unpriced.rules).toMatchObject({
        redeemValuePerPoint: null,
        minRedeemPoints: 0,
        activationDays: 0,
        pointsValidDays: 0,
      });
      expect(unpriced.card.lifetimeBillCnt).toBe(0);
    });
  });

  // ── §5.4 expiring ─────────────────────────────────────────────────────────
  describe('expiring', () => {
    it('looks 30 days ahead, ACTIVE members with a mobile only, earliest expiry first', async () => {
      db.expiringPage = [expiringRow()];

      const result = await service.expiring({ companyId: COMPANY_ID });

      const page = db.callWith('FROM base f');
      expect(page.sql).toContain('ORDER BY f.expires_on ASC NULLS LAST, f.customer_name, f.member_id');
      expect(page.values).toEqual(
        expect.arrayContaining([TODAY, 30, true, [...LOYALTY_LOT_TXN_TYPES]]),
      );
      expect(page.values.slice(-2)).toEqual([50, 0]);
      expect(result).toMatchObject({ asOn: TODAY, withinDays: 30, total: 7 });
    });

    it('drops the ACTIVE and mobile filters when told', async () => {
      await service.expiring({ companyId: COMPANY_ID, activeOnly: false, hasMobile: false });

      const page = db.callWith('FROM base f');
      expect(page.sql).toContain("(NOT ?::boolean OR m.lmb_status = 'ACTIVE')");
      expect(page.values.filter((v) => typeof v === 'boolean')).toEqual([false, false]);
    });

    it('filters on the lapsing lot’s scheme, not the member’s', async () => {
      await service.expiring({ companyId: COMPANY_ID, lscId: SCHEME_ID });

      expect(db.callWith('FROM base f').sql).toContain('l.lld_lsc_id = ?::uuid');
    });

    it('maps a row, with the balance left after the lapse', async () => {
      db.expiringPage = [expiringRow()];

      const { items } = await service.expiring({ companyId: COMPANY_ID });

      expect(items[0]).toEqual({
        memberId: MEMBER_ID,
        custId: CUST_ID,
        customerName: 'Ravi Stores',
        cardNo: 'LC-0001',
        mobile: '9876543210',
        lscId: SCHEME_ID,
        schemeName: 'Gold',
        status: 'ACTIVE',
        expiresOn: '2026-10-25',
        daysLeft: 4,
        points: 40.5,
        value: '20.25',
        balance: 150,
        balanceAfter: 109.5,
        lastActivityOn: '2026-10-20',
        branchId: BRANCH_ID,
        branchName: 'Main',
      });
    });

    it('values nothing when none of the lapsing points is priced', async () => {
      db.expiringPage = [expiringRow({ priced_points: D(0), priced_value: D(0) })];

      const { items } = await service.expiring({ companyId: COMPANY_ID });

      expect(items[0].value).toBeNull();
    });

    it.each([
      [5, [{ label: '≤5', fromDay: 0, toDay: 5 }]],
      [
        10,
        [
          { label: '≤7', fromDay: 0, toDay: 7 },
          { label: '8-10', fromDay: 8, toDay: 10 },
        ],
      ],
      [
        30,
        [
          { label: '≤7', fromDay: 0, toDay: 7 },
          { label: '8-15', fromDay: 8, toDay: 15 },
          { label: '16-30', fromDay: 16, toDay: 30 },
        ],
      ],
    ])('cuts the tiles for withinDays %i', async (withinDays, cuts) => {
      const { summary } = await service.expiring({ companyId: COMPANY_ID, withinDays });

      expect(summary.buckets.map(({ label, fromDay, toDay }) => ({ label, fromDay, toDay }))).toEqual(
        cuts,
      );
      expect(db.callWith('value_at_risk').sql).not.toContain('LIMIT');
    });

    it('summarises the tiles and the value at risk', async () => {
      const { summary } = await service.expiring({ companyId: COMPANY_ID });

      expect(summary).toEqual({
        buckets: [
          { label: '≤7', fromDay: 0, toDay: 7, points: 10, members: 1 },
          { label: '8-15', fromDay: 8, toDay: 15, points: 20, members: 2 },
          { label: '16-30', fromDay: 16, toDay: 30, points: 30, members: 3 },
        ],
        valueAtRisk: '30.50',
        members: 4,
        points: 60,
      });
    });

    it('refuses a sort key the tab does not have', async () => {
      const refusal = await refusalOf(service.expiring({ companyId: COMPANY_ID, sort: 'earned' }));

      expect(refusal).toMatchObject({ status: 400, body: { errors: [{ code: LOYALTY_STATUS_ERROR.BAD_SORT }] } });
    });
  });

  // ── §5.5 calendar ─────────────────────────────────────────────────────────
  describe('calendar', () => {
    it('lists Monday weeks over the next 90 days by default', async () => {
      db.calendar = [
        { week_start: '2026-10-19', points: D('12.5'), members: 2n },
        { week_start: '2026-10-26', points: null, members: 0n },
      ];

      const result = await service.calendar({ companyId: COMPANY_ID });

      expect(result).toEqual({
        asOn: TODAY,
        days: 90,
        weeks: [
          { weekStart: '2026-10-19', points: 12.5, members: 2 },
          { weekStart: '2026-10-26', points: 0, members: 0 },
        ],
      });
      const call = db.callWith("interval '7 days'");
      expect(call.sql).toContain("date_trunc('week', ?::date)::date");
      expect(call.values).toEqual(expect.arrayContaining([TODAY, 90, COMPANY_ID]));
    });

    it('takes the window, the scheme and the branch it is given', async () => {
      await service.calendar({ companyId: COMPANY_ID, branchId: BRANCH_ID, lscId: SCHEME_ID, days: 14 });

      expect(db.callWith("interval '7 days'").values).toEqual(
        expect.arrayContaining([14, SCHEME_ID, BRANCH_ID]),
      );
    });
  });

  // ── §5.6 schemes ──────────────────────────────────────────────────────────
  describe('schemes', () => {
    it('refuses a period that runs backwards', async () => {
      const refusal = await refusalOf(
        service.schemes({ companyId: COMPANY_ID, from: '2026-10-21', to: '2026-04-01' }),
      );

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.RANGE_REVERSED, 'from', '2026-10-21 is after 2026-04-01.'),
      });
    });

    it('splits by scheme by default, adding every live scheme, and reads no holders when nothing moved', async () => {
      const result = await service.schemes(PERIOD);

      const call = db.callWith('WITH mv AS');
      expect(call.sql).toContain('NULL::uuid AS branch_id');
      expect(call.sql).toContain('NULL::date AS month');
      expect(call.values).toEqual(expect.arrayContaining(['2026-04-01', '2026-10-21', true]));
      expect(db.ran('AS holders')).toBe(false);
      expect(db.ran('AS valid_till')).toBe(false);
      expect(result).toMatchObject({ asOn: TODAY, from: '2026-04-01', to: '2026-10-21', splitBy: 'scheme', items: [], total: 0 });
    });

    it('maps a live scheme: value at its rate, used % to one decimal, its holders', async () => {
      db.schemes = [schemeRow()];
      db.holders = [{ lsc_id: SCHEME_ID, branch_id: null, holders: 4n }];

      const { items } = await service.schemes(PERIOD);

      expect(items).toEqual([
        {
          lscId: SCHEME_ID,
          schemeName: 'Gold',
          schemeCode: 'GOLD',
          status: 'APPROVED',
          startDate: '2026-04-01',
          endDate: null,
          pointsValidTill: null,
          branchId: null,
          branchName: null,
          month: null,
          holders: 4,
          bills: 9,
          opening: 100,
          earned: 400,
          redeemed: 150,
          gift: 50,
          expired: 20,
          adjusted: -30,
          outstanding: 250,
          value: '125.00',
          usedPct: 50,
          // (150 + 50) / 400 = 50.0 %
        },
      ]);
    });

    it.each([
      ['a scheme that does not redeem points', { lsc_allow_point_redeem: false }],
      ['a scheme priced at 0', { lsc_redeem_value_per_point: D(0) }],
    ])('values nothing for %s', async (_label, overrides) => {
      db.schemes = [schemeRow(overrides)];

      const { items } = await service.schemes(PERIOD);

      expect(items[0].value).toBeNull();
    });

    it('answers no used % for a scheme that earned nothing, and 0 holders when none hold points', async () => {
      db.schemes = [schemeRow({ earned: D(0) })];

      const { items } = await service.schemes(PERIOD);

      expect(items[0]).toMatchObject({ usedPct: null, holders: 0 });
    });

    it('keeps a deleted scheme that still holds points, named and dated by its lots (notes 91 N1)', async () => {
      db.schemes = [schemeRow({ lsc_name: null, lsc_code: null, lsc_status: null, lsc_is_active: null, lsc_is_deleted: null })];
      db.validTill = [{ lsc_id: SCHEME_ID, valid_till: '2027-03-31' }];

      const { items } = await service.schemes(PERIOD);

      expect(items[0]).toMatchObject({
        schemeName: '(deleted scheme)',
        schemeCode: '',
        status: 'DELETED',
        pointsValidTill: '2027-03-31',
      });
    });

    it.each([
      ['past its end date', { end_date: '2026-09-30' }, 'ENDED'],
      ['switched off', { lsc_is_active: false }, 'ENDED'],
      ['never approved', { lsc_status: 'DRAFT' }, 'DRAFT'],
      ['with no status at all', { lsc_status: null }, 'UNKNOWN'],
    ])('shows an ended scheme %s while it holds points', async (_label, overrides, status) => {
      db.schemes = [schemeRow(overrides)];
      db.validTill = [{ lsc_id: SCHEME_ID, valid_till: null }];

      const { items } = await service.schemes(PERIOD);

      expect(items[0]).toMatchObject({ status, pointsValidTill: null });
    });

    it('drops an ended scheme once its points are gone, or whenever told to', async () => {
      db.schemes = [
        schemeRow({ lsc_id: 'empty', end_date: '2026-09-30', outstanding: D(0) }),
        schemeRow({ lsc_id: 'holding', end_date: '2026-09-30' }),
        schemeRow({ lsc_id: 'live', outstanding: D(0) }),
      ];

      const kept = await service.schemes(PERIOD);
      const dropped = await service.schemes({ ...PERIOD, includeClosedHolding: false });

      expect(kept.items.map((i) => i.lscId)).toEqual(['holding', 'live']);
      expect(dropped.items.map((i) => i.lscId)).toEqual(['live']);
    });

    it('splits by branch, counting holders per scheme and branch', async () => {
      db.schemes = [
        schemeRow({ branch_id: BRANCH_ID, branch_name: 'Main' }),
        schemeRow({ branch_id: null, branch_name: null }),
      ];
      db.holders = [
        { lsc_id: SCHEME_ID, branch_id: BRANCH_ID, holders: 3n },
        { lsc_id: SCHEME_ID, branch_id: null, holders: 1n },
      ];

      const { items } = await service.schemes({ ...PERIOD, splitBy: 'scheme_branch' });

      expect(items.map((i) => [i.branchName, i.holders])).toEqual([
        ['Main', 3],
        [null, 1],
      ]);
      expect(db.callWith('WITH mv AS').sql).toContain('l.lld_branch_id AS branch_id');
      expect(db.callWith('WITH mv AS').values).toContain(false);
    });

    it('splits by month with no holders, and names the month YYYY-MM', async () => {
      db.schemes = [schemeRow({ month: '2026-05-01' })];

      const { items } = await service.schemes({ ...PERIOD, splitBy: 'scheme_month' });

      expect(items[0]).toMatchObject({ month: '2026-05', holders: null });
      expect(db.ran('AS holders')).toBe(false);
      expect(db.callWith('WITH mv AS').sql).toContain("date_trunc('month', l.lld_txn_date)::date AS month");
    });

    it('totals the rows, value as an exact two-decimal sum', async () => {
      db.schemes = [
        schemeRow({ lsc_id: 'a', outstanding: D('100.1') }),
        schemeRow({ lsc_id: 'b', outstanding: D('200.2'), lsc_allow_point_redeem: false }),
        schemeRow({ lsc_id: 'c', outstanding: D('0.3') }),
      ];

      const { summary } = await service.schemes(PERIOD);

      expect(summary).toEqual({
        bills: 27,
        opening: 300,
        earned: 1200,
        redeemed: 450,
        gift: 150,
        expired: 60,
        adjusted: -90,
        outstanding: 300.6,
        value: '50.20',
      });
    });

    it('sorts in memory, nulls last either way', async () => {
      db.schemes = [
        schemeRow({ lsc_id: 'a', earned: D(10), lsc_allow_point_redeem: false }),
        schemeRow({ lsc_id: 'b', earned: D(30) }),
        schemeRow({ lsc_id: 'c', earned: D(20) }),
      ];

      const byEarned = await service.schemes({ ...PERIOD, sort: 'earned', order: 'desc' });
      const byValueAsc = await service.schemes({ ...PERIOD, sort: 'value' });
      const byValueDesc = await service.schemes({ ...PERIOD, sort: 'value', order: 'desc' });

      expect(byEarned.items.map((i) => i.lscId)).toEqual(['b', 'c', 'a']);
      expect(byValueAsc.items.map((i) => i.lscId).at(-1)).toBe('a');
      expect(byValueDesc.items.map((i) => i.lscId).at(-1)).toBe('a');
    });

    it('refuses a sort key the tab does not have', async () => {
      db.schemes = [schemeRow()];

      const refusal = await refusalOf(service.schemes({ ...PERIOD, sort: 'balance' }));

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.BAD_SORT, 'sort', 'Unknown sort key "balance".'),
      });
    });
  });

  // ── §5.7 monthly ──────────────────────────────────────────────────────────
  describe('monthly', () => {
    it('lists every month, marking the ones the period does not cover whole', async () => {
      db.monthly = [
        { month: '2026-04-01', earned: D(100), redeemed_gift: D(30), expired: D(0), adjusted: D(5) },
        { month: '2026-05-01', earned: D(0), redeemed_gift: D(0), expired: D(0), adjusted: D(0) },
        { month: '2026-06-01', earned: D(50), redeemed_gift: D(10), expired: D(2), adjusted: D(-1) },
      ];

      const result = await service.monthly({
        companyId: COMPANY_ID,
        lscId: SCHEME_ID,
        from: '2026-04-15',
        to: '2026-06-30',
      });

      expect(result).toEqual({
        lscId: SCHEME_ID,
        schemeName: 'Gold',
        from: '2026-04-15',
        to: '2026-06-30',
        months: [
          { month: '2026-04', earned: 100, redeemedPlusGift: 30, expired: 0, adjusted: 5, partial: true },
          { month: '2026-05', earned: 0, redeemedPlusGift: 0, expired: 0, adjusted: 0, partial: false },
          { month: '2026-06', earned: 50, redeemedPlusGift: 10, expired: 2, adjusted: -1, partial: false },
        ],
      });
      expect(db.callWith("interval '1 month'").values).toEqual(
        expect.arrayContaining(['2026-04-15', '2026-06-30', SCHEME_ID]),
      );
    });

    it('knows a leap February ends on the 29th', async () => {
      db.monthly = [{ month: '2028-02-01', earned: D(1), redeemed_gift: D(0), expired: D(0), adjusted: D(0) }];

      const ends28 = await service.monthly({ companyId: COMPANY_ID, lscId: SCHEME_ID, from: '2028-02-01', to: '2028-02-28' });
      const ends29 = await service.monthly({ companyId: COMPANY_ID, lscId: SCHEME_ID, from: '2028-02-01', to: '2028-02-29' });

      expect(ends28.months[0].partial).toBe(true);
      expect(ends29.months[0].partial).toBe(false);
    });

    it('answers an empty name for a scheme row it cannot read', async () => {
      db.schemeName = [];

      const result = await service.monthly({ ...PERIOD, lscId: SCHEME_ID });

      expect(result.schemeName).toBe('');
    });

    it('refuses a period that runs backwards', async () => {
      const refusal = await refusalOf(
        service.monthly({ companyId: COMPANY_ID, lscId: SCHEME_ID, from: '2026-06-01', to: '2026-05-01' }),
      );

      expect(refusal.status).toBe(400);
    });
  });

  // ── §5.8 gifts ────────────────────────────────────────────────────────────
  describe('gifts', () => {
    const giftRow = (overrides: Record<string, unknown> = {}) => ({
      lsg_id: GIFT_ID,
      lsg_slno: 1,
      lsg_item_id: ITEM_ID,
      item_name_en: 'Mixer',
      lsg_item_qty: D(1),
      lsg_redeem_points: D(500),
      lsg_repeat: true,
      lsg_max_qty_per_bill: D(2),
      lsg_stock_check: true,
      valid_from: '2026-04-01',
      valid_upto: null,
      lsg_is_active: true,
      eligible_members: 6n,
      issued: D(3),
      in_stock: D('4.5'),
      ...overrides,
    });

    it("maps each gift, its eligible members, what was issued and what is in stock", async () => {
      db.gifts = [giftRow()];

      const result = await service.gifts({ ...PERIOD, lscId: SCHEME_ID, branchId: BRANCH_ID });

      expect(result).toEqual({
        asOn: TODAY,
        lscId: SCHEME_ID,
        schemeName: 'Gold',
        from: '2026-04-01',
        to: '2026-10-21',
        gifts: [
          {
            lsgId: GIFT_ID,
            slno: 1,
            itemId: ITEM_ID,
            itemName: 'Mixer',
            itemQty: 1,
            points: 500,
            repeat: true,
            maxQtyPerBill: 2,
            stockCheck: true,
            validFrom: '2026-04-01',
            validUpto: null,
            isActive: true,
            eligibleMembers: 6,
            issuedInPeriod: 3,
            inStock: '4.500',
          },
        ],
      });
      const call = db.callWith('eligible_members');
      expect(call.sql).toContain("h.lgr_status     = 'CONFIRMED'");
      expect(call.sql).toContain("sbl_bucket     = 'SALEABLE'");
      expect(call.values).toEqual(
        expect.arrayContaining([TODAY, '2026-04-01', '2026-10-21', BRANCH_ID, SCHEME_ID]),
      );
    });

    it('answers no cap for a 0 cap, and no stock for a gift that does not check it', async () => {
      db.gifts = [giftRow({ lsg_max_qty_per_bill: D(0), in_stock: null, lsg_stock_check: false })];

      const { gifts } = await service.gifts({ ...PERIOD, lscId: SCHEME_ID });

      expect(gifts[0]).toMatchObject({ maxQtyPerBill: null, inStock: null, stockCheck: false });
    });

    it('answers an empty name for a scheme row it cannot read', async () => {
      db.schemeName = [];

      await expect(service.gifts({ ...PERIOD, lscId: SCHEME_ID })).resolves.toMatchObject({
        schemeName: '',
      });
    });
  });

  // ── §5.9 export ───────────────────────────────────────────────────────────
  describe('export', () => {
    it('prints the members tab with every default filter, as on today', async () => {
      db.memberPage = [{ ...memberRow(), total_rows: 1n }];

      const result = await service.export({ companyId: COMPANY_ID, tab: 'members' });

      expect(result).toMatchObject({
        tab: 'members',
        format: 'pdf',
        asOn: TODAY,
        companyName: 'Zeta Traders',
        branchName: null,
        totalRows: 1,
        summary: expect.objectContaining({ members: 3 }),
        printedAs:
          'Loyalty Status — Members · Company: Zeta Traders · Branch: All · Scheme: All · ' +
          'Status: ACTIVE / SUSPENDED · Balance > 0 · Earned: lifetime · As on 21-10-2026',
      });
      expect(result.rows).toEqual([expect.objectContaining({ memberId: MEMBER_ID })]);
      expect(db.callWith(...MEMBER_PAGE).values.slice(-2)).toEqual([20_001, 0]);
    });

    it('prints every members filter that was applied', async () => {
      const result = await service.export({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        lscId: SCHEME_ID,
        tab: 'members',
        format: 'xlsx',
        includeMergedClosed: true,
        balanceGtZero: false,
        eligibleOnly: true,
        pointsMin: 100,
        earnedFrom: '2026-04-01',
        earnedTo: '2026-10-21',
        search: 'ravi',
        sort: 'balance',
        order: 'desc',
      });

      expect(result.format).toBe('xlsx');
      expect(result.branchName).toBe('Main');
      expect(result.printedAs).toBe(
        'Loyalty Status — Members · Company: Zeta Traders · Branch: Main · Scheme: Gold · ' +
          'Status: ACTIVE / SUSPENDED / CLOSED / MERGED · Zero balances included · ' +
          'Eligible customers only · Points 100 to ∞ · Earned 01-04-2026 to 21-10-2026 · ' +
          'Search "ravi" · Sorted by balance desc · As on 21-10-2026',
      );
    });

    it('names the one status asked for, and a points band with only its top', async () => {
      const result = await service.export({
        companyId: COMPANY_ID,
        tab: 'members',
        status: 'SUSPENDED',
        pointsMax: 50,
        sort: 'balance',
      });

      expect(result.printedAs).toContain('Status: SUSPENDED');
      expect(result.printedAs).toContain('Points 0 to 50');
      expect(result.printedAs).toContain('Sorted by balance asc');
    });

    it('falls back to the company id when the company row cannot be read', async () => {
      db.company = [];

      const result = await service.export({ companyId: COMPANY_ID, tab: 'members' });

      expect(result.companyName).toBeNull();
      expect(result.printedAs).toContain(`Company: ${COMPANY_ID}`);
    });

    it.each([
      ['refuses more than 20,000 rows', 20_001n, 422],
      ['lets exactly 20,000 through', 20_000n, 200],
    ])('%s', async (_label, totalRows, status) => {
      db.memberPage = [{ ...memberRow(), total_rows: totalRows }];

      const outcome = await service
        .export({ companyId: COMPANY_ID, tab: 'members' })
        .then(() => ({ status: 200, body: null }), (e: HttpException) => ({ status: e.getStatus(), body: e.getResponse() }));

      expect(outcome.status).toBe(status);
      if (status === 422) {
        expect(outcome.body).toEqual({
          success: false,
          message: 'Export too large',
          errors: [
            {
              field: 'tab',
              code: LOYALTY_STATUS_ERROR.RANGE_TOO_LARGE,
              message: '20001 rows — the export stops at 20000. Narrow the filters.',
            },
          ],
        });
      }
    });

    it('refuses a members export whose earned period runs backwards', async () => {
      const refusal = await refusalOf(
        service.export({ companyId: COMPANY_ID, tab: 'members', earnedFrom: '2026-10-21', earnedTo: '2026-01-01' }),
      );

      expect(refusal).toMatchObject({ status: 400, body: { errors: [{ code: LOYALTY_STATUS_ERROR.RANGE_REVERSED }] } });
    });

    it('prints the expiring tab', async () => {
      db.expiringPage = [expiringRow({ total_rows: 1n })];

      const defaults = await service.export({ companyId: COMPANY_ID, tab: 'expiring' });
      const relaxed = await service.export({
        companyId: COMPANY_ID,
        tab: 'expiring',
        withinDays: 7,
        hasMobile: false,
        activeOnly: false,
      });

      expect(defaults.printedAs).toBe(
        'Loyalty Status — Expiring soon · Company: Zeta Traders · Branch: All · Scheme: All · ' +
          'Expiring within 30 days · With mobile only · Active members only · As on 21-10-2026',
      );
      expect(defaults.summary).toMatchObject({ points: 60 });
      expect(relaxed.printedAs).toContain('Expiring within 7 days · As on');
    });

    it('refuses an expiring export over the cap', async () => {
      db.expiringPage = [expiringRow({ total_rows: 20_001n })];

      const refusal = await refusalOf(service.export({ companyId: COMPANY_ID, tab: 'expiring' }));

      expect(refusal.status).toBe(422);
    });

    it('refuses a schemes export without its period', async () => {
      const refusal = await refusalOf(
        service.export({ companyId: COMPANY_ID, tab: 'schemes', from: '2026-04-01' }),
      );

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.RANGE_REVERSED, 'from', 'The scheme summary needs from and to.'),
      });
    });

    it('prints the schemes tab with its split and totals', async () => {
      db.schemes = [schemeRow({ branch_id: BRANCH_ID, branch_name: 'Main' })];

      const result = await service.export({
        companyId: COMPANY_ID,
        tab: 'schemes',
        from: '2026-04-01',
        to: '2026-10-21',
        splitBy: 'scheme_branch',
        includeClosedHolding: false,
        sort: 'earned',
      });

      expect(result.summary).toEqual({ bills: 9, outstanding: 250 });
      expect(result.totalRows).toBe(1);
      expect(result.printedAs).toBe(
        'Loyalty Status — Scheme summary · Company: Zeta Traders · Branch: All · Scheme: All · ' +
          'Period 01-04-2026 to 21-10-2026 · Split by scheme + branch · Closed schemes dropped · ' +
          'Sorted by earned asc · As on 21-10-2026',
      );
    });

    it('prints a schemes export with the defaults', async () => {
      const result = await service.export({ ...PERIOD, tab: 'schemes' });

      expect(result.printedAs).toContain('Split by scheme · Closed schemes holding points included');
    });

    it('refuses a statement export without a member', async () => {
      const refusal = await refusalOf(service.export({ companyId: COMPANY_ID, tab: 'statement' }));

      expect(refusal).toEqual({
        status: 400,
        body: refusedBody(LOYALTY_STATUS_ERROR.MEMBER_NOT_FOUND, 'memberId', 'A statement needs memberId.'),
      });
    });

    it('prints a member statement, naming the member and the period', async () => {
      db.statement = [statementRow('a', '2026-03-01', 100, 100), statementRow('b', '2026-05-01', 20, 120)];

      const result = await service.export({
        companyId: COMPANY_ID,
        tab: 'statement',
        memberId: MEMBER_ID,
        from: '2026-04-01',
        showReversals: false,
      });

      expect(result.summary).toEqual({ opening: 100, closing: 120 });
      expect(result.rows).toHaveLength(1);
      expect(result.printedAs).toBe(
        'Loyalty Status — Member statement · Company: Zeta Traders · Branch: All · ' +
          'Member: Ravi Stores (LC-0001) · Period 01-04-2026 to 21-10-2026 · ' +
          'Reversed pairs hidden · As on 21-10-2026',
      );
    });

    it('names a statement member by id when the card cannot be read', async () => {
      db.card = [];

      const result = await service.export({ companyId: COMPANY_ID, tab: 'statement', memberId: MEMBER_ID });

      expect(result.printedAs).toContain(`Member: ${MEMBER_ID} · Period start to 21-10-2026 · As on`);
    });

    it('names a statement member without a card number', async () => {
      db.card = [{ card_no: null, cus_name: 'Ravi Stores' }];

      const result = await service.export({ companyId: COMPANY_ID, tab: 'statement', memberId: MEMBER_ID });

      expect(result.printedAs).toContain('Member: Ravi Stores · Period');
    });
  });
});
