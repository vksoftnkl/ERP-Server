import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { LoyaltyLedgerService } from './loyalty-ledger.service';
import { SALES_ERROR_CODES } from './types/posting.types';
import type {
  LoyaltyBillLine,
  LoyaltyBillSource,
  LoyaltyScheme,
} from './types/loyalty.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46c002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46c003';
const OTHER_BRANCH = '019c6f6c-be87-7a11-8905-36092c46c004';
const MEMBER_ID = '019c6f6c-be87-7a11-8905-36092c46c005';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46c006';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46c007';
const RETURN_ID = '019c6f6c-be87-7a11-8905-36092c46c008';
const TENDER_ID = '019c6f6c-be87-7a11-8905-36092c46c009';
const SCHEME_ID = '019c6f6c-be87-7a11-8905-36092c46c010';
const APPROVER = '019c6f6c-be87-7a11-8905-36092c46c011';
const LOT_A = '019c6f6c-be87-7a11-8905-36092c46c0a1';
const LOT_B = '019c6f6c-be87-7a11-8905-36092c46c0b2';
const YEAR = '2026-2027';
const MSG = SALES_ERROR_CODES.LOYALTY_CAP;

// ── the bound-value layouts of the two INSERTs ────────────────────────────

/** `writeLedgerRows`' VALUES tuple, in bind order. */
const LEDGER_FIELDS = [
  'compId', 'branchId', 'tenantId', 'accYear', 'memberId', 'custId',
  'lscId', 'lssId', 'lsiId', 'txnType', 'rowNo', 'points',
  'txnDate', 'txnTime', 'lotId', 'lotAccYear', 'expiresOn', 'activeFrom',
  'srcModule', 'srcDocType', 'srcDocId', 'srcAccYear', 'srcDocRefno', 'srcRowNo',
  'baseAmount', 'baseQty', 'rate', 'factor', 'moneyValue',
  'tenderId', 'tenderAccYear', 'reversalOfId', 'reversalOfAccYear', 'reversalReason',
  'approvedBy', 'userId', 'sessionId', 'deviceId', 'remarks', 'createdBy',
] as const; // prettier-ignore

/** `writeCouponTxnRows`' VALUES tuple, in bind order. */
const COUPON_FIELDS = [
  'compId', 'branchId', 'accYear', 'lcpId', 'lcbId', 'custId', 'memberId', 'txnType',
  'rowNo', 'amount', 'txnDate', 'billAmount', 'percentApplied', 'srcModule', 'srcDocType',
  'srcDocId', 'srcAccYear', 'srcDocRefno', 'tenderId', 'tenderAccYear', 'reversalOfId',
  'reversalOfAccYear', 'reversalReason', 'approvedBy', 'remarks', 'createdBy',
] as const; // prettier-ignore

const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?');

/** Every statement whose SQL contains `needle`, as one flat Prisma.Sql each. */
function statements(mock: jest.Mock, needle: string): Prisma.Sql[] {
  return mock.mock.calls
    .filter((call) => sqlOf(call).includes(needle))
    .map(([strings, ...values]) => Prisma.sql(strings as TemplateStringsArray, ...values));
}

function decode(values: unknown[], fields: readonly string[]): Record<string, unknown>[] {
  if (values.length % fields.length !== 0) {
    throw new Error(`${values.length} values do not split into rows of ${fields.length}`);
  }
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < values.length; i += fields.length) {
    rows.push(Object.fromEntries(fields.map((f, j) => [f, values[i + j]])));
  }
  return rows;
}

/** The ledger rows every `INSERT INTO sales.loyalty_ledger` bound, in order. */
const ledgerRows = (queryRaw: jest.Mock) =>
  statements(queryRaw, 'INSERT INTO sales.loyalty_ledger').flatMap((s) =>
    decode(s.values, LEDGER_FIELDS),
  );

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

const refused = (status: number, field: string) => ({
  status,
  body: { errors: [{ field, code: MSG }] },
});

// ── the database, as far as the service reads it ──────────────────────────

type Db = {
  consumeMember: unknown[];
  lockMember: unknown[];
  redeemable: number;
  balance: number;
  lots: unknown[];
  maxRowNos: { lld_txn_type: string; max_row_no: number }[];
  latestScheme: unknown[];
  drainLots: unknown[];
  existingMember: unknown[];
  schemes: unknown[];
  items: unknown[];
  slabs: unknown[];
  elsewhere: bigint;
  originals: unknown[];
  tenderOriginals: unknown[];
  reversed: string[];
  lapsed: unknown[];
  lapsedCoupons: unknown[];
};

const lotRow = (id: string, balance: number, overrides: Record<string, unknown> = {}) => ({
  lld_id: id,
  lld_acc_year: YEAR,
  lld_lot_balance: new Prisma.Decimal(balance),
  lld_expires_on: null,
  lld_active_from: null,
  lld_txn_date: new Date('2026-09-01T00:00:00.000Z'),
  lld_lsc_id: SCHEME_ID,
  lld_branch_id: BRANCH_ID,
  ...overrides,
});

function fakeDb(overrides: Partial<Db> = {}) {
  const db: Db = {
    consumeMember: [{ lmb_comp_id: COMPANY_ID, lmb_cust_id: CUST_ID }],
    lockMember: [
      {
        lmb_comp_id: COMPANY_ID,
        lmb_cust_id: CUST_ID,
        lmb_lsc_id: SCHEME_ID,
        lmb_status: 'ACTIVE',
        lmb_branch_id: BRANCH_ID,
        lmb_is_deleted: false,
      },
    ],
    redeemable: 0,
    balance: 0,
    lots: [],
    maxRowNos: [],
    latestScheme: [],
    drainLots: [],
    existingMember: [],
    schemes: [],
    items: [],
    slabs: [],
    elsewhere: 0n,
    originals: [],
    tenderOriginals: [],
    reversed: [],
    lapsed: [],
    lapsedCoupons: [],
    ...overrides,
  };
  let lld = 0;
  const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('INSERT INTO sales.loyalty_ledger')) {
      return [{ lld_id: `lld-${++lld}`, lld_acc_year: YEAR }];
    }
    if (sql.includes('INSERT INTO sales.loyalty_member')) return [{ lmb_id: 'new-member' }];
    if (sql.includes('lmb_status, lmb_branch_id')) return db.lockMember;
    if (sql.includes('SELECT lmb_comp_id, lmb_cust_id')) return db.consumeMember;
    if (sql.includes('SELECT lmb_balance_points')) return [{ lmb_balance_points: db.balance }];
    if (sql.includes('SELECT lmb_id')) return db.existingMember;
    if (sql.includes('SUM(lld_lot_balance) AS total')) return [{ total: db.redeemable }];
    if (sql.includes('lld_active_from, lld_txn_date, lld_lsc_id, lld_branch_id')) return db.lots;
    if (sql.includes('MAX(lld_row_no)')) return db.maxRowNos;
    if (sql.includes('lld_id DESC')) return db.latestScheme;
    if (sql.includes('SELECT lld_id, lld_acc_year, lld_lot_balance, lld_lsc_id')) return db.drainLots;
    if (sql.includes('FROM sales.loyalty_scheme s')) return db.schemes;
    if (sql.includes('FROM sales.loyalty_scheme_item')) return db.items;
    if (sql.includes('FROM sales.loyalty_scheme_slab')) return db.slabs;
    if (sql.includes('lld_branch_id <>')) return [{ n: db.elsewhere }];
    if (sql.includes('SELECT DISTINCT lld_reversal_of_id')) {
      return db.reversed.map((id) => ({ lld_reversal_of_id: id }));
    }
    if (sql.includes('lld_tender_id      =')) return db.tenderOriginals;
    if (sql.includes('lld_reversal_of_id IS NULL')) return db.originals;
    if (sql.includes('lld_expires_on < ')) return db.lapsed;
    if (sql.includes('FROM sales.loyalty_coupon c')) return db.lapsedCoupons;
    throw new Error(`unrouted SQL: ${sql.slice(0, 120)}`);
  });
  const executeRaw = jest.fn().mockResolvedValue(1);
  const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };
  return { db, tx, queryRaw, executeRaw, client: tx as unknown as Prisma.TransactionClient };
}

const scheme = (overrides: Partial<LoyaltyScheme> = {}): LoyaltyScheme => ({
  lscId: SCHEME_ID,
  code: 'GOLD',
  name: 'Gold rewards',
  type: 'BOTH',
  priority: 1,
  applyOn: 'BILL_AMOUNT',
  amountType: 'NET_AMOUNT',
  includeTax: true,
  billType: 'ALL',
  itemScope: 'ALL',
  branchScope: 'ALL',
  custScope: 'ALL',
  minBillAmount: 0,
  maxEarnPoints: null,
  earnOnDiscounted: true,
  earnOnCharges: false,
  earnWithRedeem: true,
  rounding: 'FLOOR',
  pointsDecimals: 0,
  allowPointRedeem: true,
  redeemValuePerPoint: 0.5,
  minRedeemPoints: 0,
  maxRedeemPoints: null,
  maxRedeemPerc: null,
  redeemMinBillAmount: 0,
  redeemMultiple: null,
  redeemTenderId: null,
  expiryBasis: 'NONE',
  pointsValidDays: null,
  activationDays: 0,
  returnMode: 'REVERSE',
  startDate: null,
  endDate: null,
  poolMode: null,
  allowCrossBranchRedeem: true,
  ...overrides,
});

const billLine = (lineNo: number, overrides: Partial<LoyaltyBillLine> = {}): LoyaltyBillLine => ({
  lineNo,
  itemId: `item-${lineNo}`,
  unitId: null,
  qty: 1,
  grossAmt: 100,
  netAmt: 100,
  taxableAmt: 100,
  isFree: false,
  allowLoyalty: true,
  groupId: null,
  categoryId: null,
  brandId: null,
  sectionId: null,
  ...overrides,
});

const bill = (overrides: Partial<LoyaltyBillSource> = {}): LoyaltyBillSource => ({
  docId: BILL_ID,
  accYear: YEAR,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  custId: CUST_ID,
  docDate: '2026-10-19',
  docRefno: 'bil00042',
  docType: 'SALE_BILL',
  billType: 'RETAIL',
  memberId: MEMBER_ID,
  chargesAmt: 0,
  redeemedAmount: 0,
  lines: [billLine(1)],
  ...overrides,
});

const slab = (overrides: Record<string, unknown> = {}) => ({
  lss_id: 'slab-1',
  lss_item_id: null,
  lss_exceeds: null,
  lss_upto: null,
  lss_each: null,
  lss_points: null,
  lss_factor: null,
  lss_max_points: null,
  ...overrides,
});

const itemRule = (overrides: Record<string, unknown> = {}) => ({
  lsi_id: 'rule-1',
  lsi_kind: 'ITEM',
  lsi_item_id: 'item-1',
  lsi_group_id: null,
  lsi_category_id: null,
  lsi_brand_id: null,
  lsi_section_id: null,
  lsi_is_exclude: false,
  lsi_factor: null,
  lsi_points: null,
  lsi_max_points: null,
  lsi_match_priority: null,
  ...overrides,
});

describe('LoyaltyLedgerService', () => {
  let prisma: { $transaction: jest.Mock; $queryRaw: jest.Mock };
  let service: LoyaltyLedgerService;

  beforeEach(() => {
    prisma = { $transaction: jest.fn(), $queryRaw: jest.fn() };
    service = new LoyaltyLedgerService(prisma as unknown as PrismaService);
  });

  // ═══ the reads ═══════════════════════════════════════════════════════════

  describe('lots / redeemable / balance', () => {
    it('maps the spendable lots, bound to the member, the day and the four lot types', async () => {
      const { client, queryRaw } = fakeDb({
        lots: [
          lotRow(LOT_A, 30, {
            lld_expires_on: new Date('2026-12-31T00:00:00.000Z'),
            lld_active_from: new Date('2026-09-05T00:00:00.000Z'),
          }),
        ],
      });

      await expect(service.lots(MEMBER_ID, '2026-10-19', client)).resolves.toEqual([
        {
          lotId: LOT_A,
          lotAccYear: YEAR,
          lotBalance: 30,
          expiresOn: '2026-12-31',
          activeFrom: '2026-09-05',
          txnDate: '2026-09-01',
          lscId: SCHEME_ID,
          branchId: BRANCH_ID,
        },
      ]);
      const [read] = statements(queryRaw, 'ORDER BY lld_expires_on NULLS LAST');
      expect(read.values).toEqual([
        MEMBER_ID,
        ['EARN', 'OPENING', 'ADJUST', 'TRANSFER'],
        '2026-10-19',
        '2026-10-19',
      ]);
    });

    it('reads a missing sum or wallet as zero', async () => {
      const { client, tx } = fakeDb();
      tx.$queryRaw.mockResolvedValue([]);

      await expect(service.redeemable(MEMBER_ID, '2026-10-19', client)).resolves.toBe(0);
      await expect(service.balance(MEMBER_ID, client)).resolves.toBe(0);
    });

    it('reads through the service client when no transaction is given', async () => {
      prisma.$queryRaw.mockResolvedValue([{ lmb_balance_points: new Prisma.Decimal('12.5') }]);

      await expect(service.balance(MEMBER_ID)).resolves.toBe(12.5);
    });
  });

  // ═══ consume ═════════════════════════════════════════════════════════════

  describe('consume', () => {
    const opts = {
      branchId: BRANCH_ID,
      accYear: YEAR,
      txnDate: '2026-10-19',
      rate: 0.5,
      srcDocType: 'SALE_BILL' as const,
      srcDocId: BILL_ID,
      srcAccYear: YEAR,
      srcDocRefno: 'bil00042',
      tenderId: TENDER_ID,
      tenderAccYear: YEAR,
    };

    it.each([0, -5, Number.NaN])('does nothing for %p points', async (points) => {
      const { client, queryRaw } = fakeDb();

      await expect(service.consume(client, MEMBER_ID, points, 'REDEEM', opts)).resolves.toBe(0);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('refuses a redemption that names no tender row', async () => {
      const { client } = fakeDb();

      expect(
        await refusalOf(service.consume(client, MEMBER_ID, 10, 'REDEEM', { ...opts, tenderId: null })),
      ).toMatchObject(refused(400, 'tenderId'));
    });

    it('refuses a gift that names a tender row', async () => {
      const { client } = fakeDb();

      expect(await refusalOf(service.consume(client, MEMBER_ID, 10, 'GIFT', opts))).toMatchObject(
        refused(400, 'tenderId'),
      );
    });

    it('refuses a take-back without an approver, or with a tender row', async () => {
      const { client } = fakeDb();
      const base = { ...opts, tenderId: null };

      expect(
        await refusalOf(service.consume(client, MEMBER_ID, 10, 'ADJUST', base)),
      ).toMatchObject(refused(400, 'approvedBy'));
      expect(
        await refusalOf(
          service.consume(client, MEMBER_ID, 10, 'ADJUST', {
            ...base,
            approvedBy: APPROVER,
            tenderId: TENDER_ID,
          }),
        ),
      ).toMatchObject(refused(400, 'tenderId'));
    });

    it('locks the wallet FOR UPDATE and refuses a member that does not exist', async () => {
      const { client, queryRaw } = fakeDb({ consumeMember: [] });

      expect(await refusalOf(service.consume(client, MEMBER_ID, 10, 'REDEEM', opts))).toMatchObject(
        refused(400, 'memberId'),
      );
      const [lock] = statements(queryRaw, 'SELECT lmb_comp_id, lmb_cust_id');
      expect(lock.sql).toContain('FOR UPDATE');
      expect(lock.sql).not.toContain('SKIP LOCKED');
    });

    it('refuses more than is redeemable today, before writing anything', async () => {
      const { client, queryRaw, executeRaw } = fakeDb({ redeemable: 40 });

      expect(await refusalOf(service.consume(client, MEMBER_ID, 50, 'REDEEM', opts))).toMatchObject(
        refused(422, 'loyaltyPoints'),
      );
      expect(ledgerRows(queryRaw)).toEqual([]);
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('draws FIFO, one negative row per lot, continuing the document’s row numbers', async () => {
      const { client, queryRaw, executeRaw } = fakeDb({
        redeemable: 80,
        lots: [lotRow(LOT_A, 30), lotRow(LOT_B, 50, { lld_lsc_id: null })],
        maxRowNos: [{ lld_txn_type: 'REDEEM', max_row_no: 2 }],
      });

      await expect(service.consume(client, MEMBER_ID, 60, 'REDEEM', opts)).resolves.toBe(2);

      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          compId: COMPANY_ID,
          custId: CUST_ID,
          memberId: MEMBER_ID,
          txnType: 'REDEEM',
          rowNo: 3,
          points: '-30.0000',
          lotId: LOT_A,
          lotAccYear: YEAR,
          lscId: SCHEME_ID,
          rate: '0.5000',
          moneyValue: '15.00',
          srcModule: 'SALES',
          srcDocType: 'SALE_BILL',
          srcDocId: BILL_ID,
          tenderId: TENDER_ID,
          createdBy: 'SYSTEM',
        }),
        expect.objectContaining({
          rowNo: 4,
          points: '-30.0000',
          lotId: LOT_B,
          lscId: null,
          moneyValue: '15.00',
        }),
      ]);
      // Lots first, then the wallet — the next-expiry date depends on it.
      const recomputes = executeRaw.mock.calls.map(sqlOf);
      expect(recomputes[0]).toContain('SET lld_consumed_points');
      expect(recomputes[1]).toContain('UPDATE sales.loyalty_member m');
      const [lotsUpdate] = statements(executeRaw, 'SET lld_consumed_points');
      expect(lotsUpdate.values).toEqual([
        [LOT_A, LOT_B],
        [YEAR, YEAR],
      ]);
      const [walletUpdate] = statements(executeRaw, 'UPDATE sales.loyalty_member m');
      expect(walletUpdate.values).toEqual([[MEMBER_ID], ['EARN', 'OPENING', 'ADJUST', 'TRANSFER']]);
    });

    it('numbers from 1 and reads no row numbers for a draw that names no document', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 10, lots: [lotRow(LOT_A, 10)] });

      await service.consume(client, MEMBER_ID, 4, 'EXPIRE', {
        branchId: BRANCH_ID,
        accYear: YEAR,
        txnDate: '2026-10-19',
        lscId: 'override-scheme',
      });

      expect(statements(queryRaw, 'MAX(lld_row_no)')).toEqual([]);
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          rowNo: 1,
          points: '-4.0000',
          lscId: 'override-scheme',
          rate: '0.0000',
          moneyValue: '0.00',
        }),
      ]);
    });

    it('fails loudly when the lots cannot cover what the wallet said was redeemable', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 50, lots: [lotRow(LOT_A, 20)] });

      await expect(service.consume(client, MEMBER_ID, 50, 'REDEEM', opts)).rejects.toThrow(
        /disagree/,
      );
      expect(ledgerRows(queryRaw)).toEqual([]);
    });
  });

  // ═══ adjust / drain ══════════════════════════════════════════════════════

  describe('adjust', () => {
    const input = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      memberId: MEMBER_ID,
      points: 50,
      txnDate: '2026-10-19',
      accYear: YEAR,
      reason: 'Goodwill',
      approvedBy: APPROVER,
    };

    it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
      'refuses an adjustment of %p points',
      async (points) => {
        const { client } = fakeDb();

        expect(await refusalOf(service.adjust(client, { ...input, points }))).toMatchObject(
          refused(400, 'points'),
        );
      },
    );

    it('refuses an adjustment nobody approved', async () => {
      const { client } = fakeDb();

      expect(await refusalOf(service.adjust(client, { ...input, approvedBy: '' }))).toMatchObject(
        refused(400, 'approvedBy'),
      );
    });

    it('refuses a lot that lapses before the day it is given', async () => {
      const { client } = fakeDb();

      expect(
        await refusalOf(service.adjust(client, { ...input, expiresOn: '2026-10-18' })),
      ).toMatchObject(refused(400, 'expiresOn'));
    });

    it.each([
      ['missing', []],
      ['deleted', [{ lmb_comp_id: COMPANY_ID, lmb_status: 'ACTIVE', lmb_is_deleted: true }]],
      ['of another company', [{ lmb_comp_id: 'other', lmb_status: 'ACTIVE', lmb_is_deleted: false }]],
    ])('refuses a member that is %s with a 400', async (_label, lockMember) => {
      const { client } = fakeDb({ lockMember });

      expect(await refusalOf(service.adjust(client, input))).toMatchObject(
        refused(400, 'memberId'),
      );
    });

    it.each(['CLOSED', 'MERGED'])('refuses to move the points of a %s wallet', async (status) => {
      const { client, db } = fakeDb();
      db.lockMember = [{ ...(db.lockMember[0] as object), lmb_status: status }];

      expect(await refusalOf(service.adjust(client, input))).toMatchObject(
        refused(422, 'memberId'),
      );
    });

    it('credits a positive adjustment as one lot of its own, under its own document', async () => {
      const { client, queryRaw } = fakeDb({ balance: 150, redeemable: 120 });

      const result = await service.adjust(client, {
        ...input,
        points: 50.00004,
        expiresOn: '2027-03-31',
        userId: 'user-1',
        createdBy: 'admin',
      });

      expect(result).toEqual({
        docId: expect.any(String),
        docRefno: expect.stringMatching(/^ADJ\/2026-10-19\/[0-9A-F]{6}$/),
        rowsWritten: 1,
        balance: 150,
        redeemable: 120,
      });
      expect(result.docRefno.endsWith(result.docId.slice(-6).toUpperCase())).toBe(true);
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'ADJUST',
          rowNo: 1,
          points: '50.0000',
          lotId: null,
          expiresOn: '2027-03-31',
          lscId: SCHEME_ID,
          srcDocType: 'LOYALTY_ADJUST',
          srcDocId: result.docId,
          srcDocRefno: result.docRefno,
          remarks: 'Goodwill',
          approvedBy: APPROVER,
          userId: 'user-1',
          createdBy: 'admin',
        }),
      ]);
    });

    it('files the adjustment under the member’s latest scheme when its wallet names none', async () => {
      const { client, db, queryRaw } = fakeDb({ latestScheme: [{ lld_lsc_id: 'latest' }] });
      db.lockMember = [{ ...(db.lockMember[0] as object), lmb_lsc_id: null }];

      await service.adjust(client, input);

      expect(ledgerRows(queryRaw)[0].lscId).toBe('latest');
    });

    it('takes a negative adjustment back FIFO through the lots, refused beyond what is redeemable', async () => {
      const { client, queryRaw } = fakeDb({
        redeemable: 40,
        lots: [lotRow(LOT_A, 25), lotRow(LOT_B, 15)],
      });

      const result = await service.adjust(client, { ...input, points: -30 });

      expect(result.rowsWritten).toBe(2);
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'ADJUST',
          rowNo: 1,
          points: '-25.0000',
          lotId: LOT_A,
          approvedBy: APPROVER,
          srcDocType: 'LOYALTY_ADJUST',
          tenderId: null,
        }),
        expect.objectContaining({ rowNo: 2, points: '-5.0000', lotId: LOT_B }),
      ]);

      const short = fakeDb({ redeemable: 10 });
      expect(await refusalOf(service.adjust(short.client, { ...input, points: -30 }))).toMatchObject(
        refused(422, 'loyaltyPoints'),
      );
    });
  });

  describe('drain', () => {
    const input = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      memberId: MEMBER_ID,
      txnDate: '2026-10-19',
      accYear: YEAR,
      reason: 'Wallet closed',
      approvedBy: APPROVER,
    };
    const drainLot = (id: string, balance: string, lsc: string | null = SCHEME_ID) => ({
      lld_id: id,
      lld_acc_year: YEAR,
      lld_lot_balance: new Prisma.Decimal(balance),
      lld_lsc_id: lsc,
    });

    it('refuses to close a wallet with points nobody approved', async () => {
      const { client } = fakeDb();

      expect(await refusalOf(service.drain(client, { ...input, approvedBy: '' }))).toMatchObject(
        refused(400, 'approvedBy'),
      );
    });

    it('drains a CLOSED wallet but refuses a MERGED one', async () => {
      const closed = fakeDb();
      closed.db.lockMember = [{ ...(closed.db.lockMember[0] as object), lmb_status: 'CLOSED' }];
      await expect(service.drain(closed.client, input)).resolves.toMatchObject({ rowsWritten: 0 });

      const merged = fakeDb();
      merged.db.lockMember = [{ ...(merged.db.lockMember[0] as object), lmb_status: 'MERGED' }];
      expect(await refusalOf(service.drain(merged.client, input))).toMatchObject(
        refused(422, 'memberId'),
      );
    });

    it('zeroes every open lot, and writes the unlotted remainder as a row of its own', async () => {
      const { client, queryRaw } = fakeDb({
        drainLots: [drainLot(LOT_A, '30'), drainLot(LOT_B, '12.5', null)],
        balance: 50,
      });

      const result = await service.drain(client, input);

      expect(result).toMatchObject({ rowsWritten: 3, redeemable: 0, balance: 50 });
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'ADJUST',
          rowNo: 1,
          points: '-30.0000',
          lotId: LOT_A,
          lscId: SCHEME_ID,
          approvedBy: APPROVER,
          moneyValue: '0.00',
        }),
        expect.objectContaining({ rowNo: 2, points: '-12.5000', lotId: LOT_B, lscId: null }),
        expect.objectContaining({ rowNo: 3, points: '-7.5000', lotId: null, lscId: SCHEME_ID }),
      ]);
    });

    it('writes a positive remainder when the lots are overdrawn, and none when they match', async () => {
      const over = fakeDb({ drainLots: [drainLot(LOT_A, '30')], balance: 25 });
      await service.drain(over.client, input);
      expect(ledgerRows(over.queryRaw).map((r) => r.points)).toEqual(['-30.0000', '5.0000']);

      const exact = fakeDb({ drainLots: [drainLot(LOT_A, '30')], balance: 30 });
      await service.drain(exact.client, input);
      expect(ledgerRows(exact.queryRaw).map((r) => r.points)).toEqual(['-30.0000']);
    });
  });

  // ═══ resolution ══════════════════════════════════════════════════════════

  describe('resolveMember', () => {
    it('takes the member the screen identified without reading', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(service.resolveMember(client, bill())).resolves.toBe(MEMBER_ID);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('never earns the walk-in ledger a wallet', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(
        service.resolveMember(client, bill({ memberId: null }), { autoEnrol: true, isWalkIn: true }),
      ).resolves.toBeNull();
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('finds the customer’s existing wallet in the company', async () => {
      const { client, queryRaw } = fakeDb({ existingMember: [{ lmb_id: 'existing' }] });

      await expect(service.resolveMember(client, bill({ memberId: null }))).resolves.toBe(
        'existing',
      );
      expect(statements(queryRaw, 'SELECT lmb_id')[0].values).toEqual([COMPANY_ID, CUST_ID]);
    });

    it('opens no wallet when auto-enrol is off', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(
        service.resolveMember(client, bill({ memberId: null }), { autoEnrol: false, isWalkIn: false }),
      ).resolves.toBeNull();
      expect(statements(queryRaw, 'INSERT INTO sales.loyalty_member')).toEqual([]);
    });

    it('opens a wallet on the first earning bill under auto-enrol', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(
        service.resolveMember(client, bill({ memberId: null }), {
          autoEnrol: true,
          isWalkIn: false,
          createdBy: 'cashier1',
        }),
      ).resolves.toBe('new-member');
      expect(statements(queryRaw, 'INSERT INTO sales.loyalty_member')[0].values).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        YEAR,
        CUST_ID,
        '2026-10-19',
        'cashier1',
      ]);
    });
  });

  describe('resolveScheme', () => {
    const schemeRow = {
      lsc_id: SCHEME_ID,
      lsc_code: 'GOLD',
      lsc_name: 'Gold rewards',
      lsc_type: 'BOTH',
      lsc_priority: 5,
      lsc_apply_on: 'BILL_AMOUNT',
      lsc_calc_on_amount_type: 'NET_AMOUNT',
      lsc_include_tax: true,
      lsc_bill_type: 'ALL',
      lsc_item_scope: 'ALL',
      lsc_branch_scope: 'ALL',
      lsc_cust_scope: 'ALL',
      lsc_min_bill_amount: null,
      lsc_max_earn_points: new Prisma.Decimal('500'),
      lsc_earn_on_discounted: true,
      lsc_earn_on_charges: false,
      lsc_earn_with_redeem: false,
      lsc_rounding_method: 'FLOOR',
      lsc_points_decimals: 2,
      lsc_allow_point_redeem: true,
      lsc_redeem_value_per_point: new Prisma.Decimal('0.25'),
      lsc_min_redeem_points: null,
      lsc_max_redeem_points: null,
      lsc_max_redeem_perc: new Prisma.Decimal('50'),
      lsc_redeem_min_bill_amount: new Prisma.Decimal('100'),
      lsc_redeem_multiple: null,
      lsc_redeem_tender_id: null,
      lsc_expiry_basis: 'EARN_DATE',
      lsc_points_valid_days: 365,
      lsc_activation_days: null,
      lsc_return_mode: 'REVERSE',
      lsc_start_date: new Date('2026-04-01T00:00:00.000Z'),
      lsc_end_date: null,
      lsc_pool_mode: 'BRANCH',
      lsc_allow_cross_branch_redeem: false,
    };

    it('asks for an earning scheme on the document’s weekday and maps the winner', async () => {
      const { client, queryRaw } = fakeDb({ schemes: [schemeRow] });

      const found = await service.resolveScheme(client, bill(), { at: '10:30' });

      expect(found).toEqual(
        expect.objectContaining({
          lscId: SCHEME_ID,
          priority: 5,
          minBillAmount: 0,
          maxEarnPoints: 500,
          rounding: 'FLOOR',
          pointsDecimals: 2,
          redeemValuePerPoint: 0.25,
          minRedeemPoints: 0,
          maxRedeemPoints: null,
          maxRedeemPerc: 50,
          redeemMinBillAmount: 100,
          expiryBasis: 'EARN_DATE',
          pointsValidDays: 365,
          activationDays: 0,
          startDate: '2026-04-01',
          endDate: null,
          poolMode: 'BRANCH',
          allowCrossBranchRedeem: false,
        }),
      );
      const [read] = statements(queryRaw, 'FROM sales.loyalty_scheme s');
      // 2026-10-19 is a Monday.
      expect(read.values.slice(0, 7)).toEqual([
        COMPANY_ID,
        ['EARN', 'BOTH'],
        '2026-10-19',
        '2026-10-19',
        'MON',
        '10:30',
        '10:30',
      ]);
      expect(read.values).toContain('RETAIL');
    });

    it('asks for a redeeming scheme, with no clock and no bill type, and answers null for none', async () => {
      const { client, queryRaw } = fakeDb({ schemes: [] });

      await expect(
        service.resolveScheme(client, bill({ billType: null, docDate: '2026-10-18' }), {
          forRedeem: true,
        }),
      ).resolves.toBeNull();
      const [read] = statements(queryRaw, 'FROM sales.loyalty_scheme s');
      expect(read.values.slice(1, 7)).toEqual([
        ['REDEEM', 'BOTH'],
        '2026-10-18',
        '2026-10-18',
        'SUN',
        null,
        null,
      ]);
      expect(read.values).toContain('ALL');
    });
  });

  // ═══ earn ════════════════════════════════════════════════════════════════

  describe('earn', () => {
    it('earns nothing, and reads nothing, with no member on the document', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(service.earn(client, bill({ memberId: null }))).resolves.toEqual({
        memberId: null,
        schemeId: null,
        points: 0,
        baseAmount: 0,
        baseQty: 0,
        rowsWritten: 0,
        expiresOn: null,
        activeFrom: null,
        lines: [],
        reason: 'No loyalty member on this document',
      });
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('earns nothing when no approved scheme covers the document', async () => {
      const { client } = fakeDb({ schemes: [] });

      await expect(service.earn(client, bill())).resolves.toMatchObject({
        memberId: MEMBER_ID,
        points: 0,
        reason: 'No approved earning scheme covers this document',
      });
    });

    it('awards a floor of whole blocks on the bill amount, writes ONE EARN lot and homes the wallet', async () => {
      const { client, queryRaw, executeRaw } = fakeDb({
        slabs: [slab({ lss_each: new Prisma.Decimal(100), lss_points: new Prisma.Decimal(1) })],
        maxRowNos: [{ lld_txn_type: 'EARN', max_row_no: 1 }],
      });

      const result = await service.earn(
        client,
        bill({ lines: [billLine(1, { netAmt: 260, qty: 2 }), billLine(2, { netAmt: 199, qty: 1 })] }),
        {
          scheme: scheme({ expiryBasis: 'EARN_DATE', pointsValidDays: 30, activationDays: 2 }),
          createdBy: 'cashier1',
        },
      );

      expect(result).toEqual({
        memberId: MEMBER_ID,
        schemeId: SCHEME_ID,
        points: 4,
        baseAmount: 459,
        baseQty: 3,
        rowsWritten: 1,
        expiresOn: '2026-11-18',
        activeFrom: '2026-10-21',
        lines: [
          { lineNo: 1, points: expect.closeTo(2.2658, 4), pv: expect.closeTo(1.1329, 4) },
          { lineNo: 2, points: expect.closeTo(1.7342, 4), pv: expect.closeTo(1.7342, 4) },
        ],
      });
      // An amend's re-post continues the EARN numbering instead of colliding on row 1.
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'EARN',
          rowNo: 2,
          points: '4.0000',
          lotId: null,
          lscId: SCHEME_ID,
          lssId: 'slab-1',
          lsiId: null,
          expiresOn: '2026-11-18',
          activeFrom: '2026-10-21',
          srcDocType: 'SALE_BILL',
          srcDocId: BILL_ID,
          srcDocRefno: 'bil00042',
          baseAmount: '459.00',
          baseQty: '3.0000',
          factor: '1.0000',
          createdBy: 'cashier1',
        }),
      ]);
      const [home] = statements(executeRaw, 'SET lmb_lsc_id');
      expect(home.sql).toContain('lmb_lsc_id IS NULL');
      expect(home.values).toEqual([SCHEME_ID, MEMBER_ID]);
    });

    it('quotes the same figures on a dry run without writing', async () => {
      const { client, queryRaw, executeRaw } = fakeDb({
        slabs: [slab({ lss_factor: new Prisma.Decimal('0.1') })],
      });

      const result = await service.earn(client, bill(), { scheme: scheme(), dryRun: true });

      expect(result).toMatchObject({ points: 10, rowsWritten: 0 });
      expect(ledgerRows(queryRaw)).toEqual([]);
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('skips free lines, lines barred from loyalty and lines an exclusion rule names', async () => {
      const { client } = fakeDb({
        items: [itemRule({ lsi_item_id: 'item-3', lsi_is_exclude: true })],
        slabs: [slab({ lss_factor: new Prisma.Decimal(1) })],
      });

      const result = await service.earn(
        client,
        bill({
          lines: [
            billLine(1, { isFree: true }),
            billLine(2, { allowLoyalty: false }),
            billLine(3),
            billLine(4, { netAmt: 40 }),
          ],
        }),
        { scheme: scheme(), dryRun: true },
      );

      expect(result).toMatchObject({ points: 40, baseAmount: 40 });
      expect(result.lines.map((l) => l.lineNo)).toEqual([4]);
    });

    it('earns nothing when no line is eligible, saying why and naming the scheme', async () => {
      const { client, queryRaw } = fakeDb({
        items: [itemRule({ lsi_item_id: 'item-9' })],
        slabs: [slab({ lss_factor: new Prisma.Decimal(1) })],
      });

      const result = await service.earn(client, bill(), { scheme: scheme({ itemScope: 'LIST' }) });

      expect(result).toMatchObject({
        schemeId: SCHEME_ID,
        points: 0,
        rowsWritten: 0,
        reason: 'No line on this document is eligible to earn',
      });
      expect(ledgerRows(queryRaw)).toEqual([]);
    });

    it('earns nothing below the scheme’s minimum bill', async () => {
      const { client } = fakeDb({ slabs: [slab({ lss_factor: new Prisma.Decimal(1) })] });

      const result = await service.earn(client, bill(), { scheme: scheme({ minBillAmount: 500 }) });

      expect(result).toMatchObject({ points: 0, reason: expect.stringContaining('below the scheme minimum') });
    });

    it('earns nothing when no slab covers a bill-level base', async () => {
      const { client } = fakeDb({
        slabs: [slab({ lss_exceeds: new Prisma.Decimal(1000), lss_factor: new Prisma.Decimal(1) })],
      });

      const result = await service.earn(client, bill(), { scheme: scheme() });

      expect(result).toMatchObject({ points: 0, reason: expect.stringContaining('No slab') });
    });

    it('takes charges in, and the rupees paid by points out, of an amount base', async () => {
      const { client } = fakeDb({ slabs: [slab({ lss_factor: new Prisma.Decimal('0.01') })] });

      const withCharges = await service.earn(client, bill({ chargesAmt: 50 }), {
        scheme: scheme({ earnOnCharges: true, rounding: 'NONE' }),
        dryRun: true,
      });
      expect(withCharges.baseAmount).toBe(150);

      const lessRedeemed = await service.earn(client, bill({ redeemedAmount: 30 }), {
        scheme: scheme({ earnWithRedeem: false, rounding: 'NONE' }),
        dryRun: true,
      });
      expect(lessRedeemed.baseAmount).toBe(70);

      const overRedeemed = await service.earn(client, bill({ redeemedAmount: 300 }), {
        scheme: scheme({ earnWithRedeem: false, rounding: 'NONE' }),
        dryRun: true,
      });
      expect(overRedeemed).toMatchObject({ baseAmount: 0, points: 0 });
    });

    it.each([
      ['NET_AMOUNT', true, 90],
      ['GROSS_AMOUNT', true, 120],
      ['TAXABLE_AMOUNT', true, 80],
      // Not on the discounted figure: always the gross.
      ['NET_AMOUNT', false, 120],
    ] as const)('bases %s (on discounted %p) on %p', async (amountType, earnOnDiscounted, base) => {
      const { client } = fakeDb({ slabs: [slab({ lss_factor: new Prisma.Decimal(1) })] });

      const result = await service.earn(
        client,
        bill({ lines: [billLine(1, { grossAmt: 120, netAmt: 90, taxableAmt: 80 })] }),
        { scheme: scheme({ amountType, earnOnDiscounted }), dryRun: true },
      );

      expect(result.baseAmount).toBe(base);
    });

    it('lets a line’s item rule beat the slab, and falls back to the slab for a line the rule does not price', async () => {
      const { client } = fakeDb({
        items: [
          itemRule({ lsi_id: 'by-item', lsi_points: new Prisma.Decimal(7) }),
          itemRule({
            lsi_id: 'by-group',
            lsi_kind: 'ITEM_GROUP',
            lsi_item_id: null,
            lsi_group_id: 'grp',
          }),
        ],
        slabs: [slab({ lss_id: 'per-line-slab', lss_factor: new Prisma.Decimal('0.1') })],
      });

      const result = await service.earn(
        client,
        bill({
          lines: [billLine(1, { netAmt: 300 }), billLine(2, { netAmt: 50, groupId: 'grp' })],
        }),
        { scheme: scheme({ applyOn: 'ITEM_AMOUNT', itemScope: 'LIST' }), dryRun: true },
      );

      expect(result.points).toBe(12);
      expect(result.lines).toEqual([
        { lineNo: 1, points: 7, pv: 7 },
        { lineNo: 2, points: 5, pv: 5 },
      ]);
    });

    it('records the item rule and the slab that priced a per-line award on the EARN row', async () => {
      const { client, queryRaw } = fakeDb({
        items: [itemRule({ lsi_id: 'by-item', lsi_points: new Prisma.Decimal(7) })],
        slabs: [slab({ lss_id: 'per-line-slab', lss_factor: new Prisma.Decimal('0.1') })],
      });

      await service.earn(client, bill({ lines: [billLine(1), billLine(2)] }), {
        scheme: scheme({ applyOn: 'ITEM_AMOUNT' }),
      });

      expect(ledgerRows(queryRaw)[0]).toMatchObject({ lsiId: 'by-item', lssId: 'per-line-slab' });
    });

    it('prefers the item rule with the higher match priority, then the more specific kind', async () => {
      const { client } = fakeDb({
        items: [
          itemRule({ lsi_id: 'brand', lsi_kind: 'ITEM_BRAND', lsi_item_id: null, lsi_brand_id: 'b', lsi_points: new Prisma.Decimal(3) }),
          itemRule({ lsi_id: 'item', lsi_points: new Prisma.Decimal(9) }),
          itemRule({ lsi_id: 'section', lsi_kind: 'ITEM_SECTION', lsi_item_id: null, lsi_section_id: 's', lsi_points: new Prisma.Decimal(5), lsi_match_priority: 10 }),
        ],
      }); // prettier-ignore

      const result = await service.earn(
        client,
        bill({ lines: [billLine(1, { brandId: 'b', sectionId: 's' }), billLine(2, { itemId: 'x', brandId: 'b' })] }),
        { scheme: scheme({ applyOn: 'ITEM_QTY' }), dryRun: true },
      ); // prettier-ignore

      // Line 1: the section rule's priority 10 beats the item rule; line 2: only the brand.
      expect(result.lines).toEqual([
        { lineNo: 1, points: 5, pv: 5 },
        { lineNo: 2, points: 3, pv: 3 },
      ]);
    });

    it('caps an award at the rule’s maximum and the scheme’s, scaling the line snapshots to match', async () => {
      const { client } = fakeDb({
        slabs: [slab({ lss_factor: new Prisma.Decimal(1), lss_max_points: new Prisma.Decimal(80) })],
      });

      const capped = await service.earn(
        client,
        bill({ lines: [billLine(1, { netAmt: 60 }), billLine(2, { netAmt: 40 })] }),
        { scheme: scheme({ maxEarnPoints: 20 }), dryRun: true },
      );

      expect(capped.points).toBe(20);
      expect(capped.lines).toEqual([
        { lineNo: 1, points: 12, pv: 12 },
        { lineNo: 2, points: 8, pv: 8 },
      ]);
    });

    it.each([
      ['FLOOR', 1, 3.4],
      ['CEIL', 1, 3.5],
      ['ROUND', 0, 3],
      ['NONE', 0, 3.45],
    ] as const)('rounds 3.45 points %s to %p places as %p', async (rounding, decimals, points) => {
      const { client } = fakeDb({ slabs: [slab({ lss_factor: new Prisma.Decimal('0.0345') })] });

      const result = await service.earn(client, bill(), {
        scheme: scheme({ rounding, pointsDecimals: decimals }),
        dryRun: true,
      });

      expect(result.points).toBeCloseTo(points, 10);
    });

    it('takes an item-scoped slab over an open one, and respects the exclusive lower bound', async () => {
      const { client } = fakeDb({
        slabs: [
          slab({ lss_id: 'open', lss_factor: new Prisma.Decimal(1) }),
          slab({ lss_id: 'for-item-1', lss_item_id: 'item-1', lss_factor: new Prisma.Decimal(2) }),
          slab({ lss_id: 'above-100', lss_exceeds: new Prisma.Decimal(100), lss_factor: new Prisma.Decimal(9) }),
        ],
      }); // prettier-ignore

      const result = await service.earn(client, bill(), {
        scheme: scheme({ applyOn: 'ITEM_AMOUNT' }),
        dryRun: true,
      });

      // 100 is not above 100; the item's own slab beats the open one.
      expect(result.points).toBe(200);
    });

    it.each([
      ['EARN_DATE', { pointsValidDays: 10 }, '2026-10-29'],
      ['MONTH_END', {}, '2026-10-31'],
      ['YEAR_END', {}, '2027-03-31'],
      ['SCHEME_END_DATE', { endDate: '2026-12-25' }, '2026-12-25'],
      ['NONE', {}, null],
    ] as const)('lapses a %s lot on %p', async (expiryBasis, extra, expiresOn) => {
      const { client } = fakeDb({ slabs: [slab({ lss_factor: new Prisma.Decimal(1) })] });

      const result = await service.earn(client, bill(), {
        scheme: scheme({ expiryBasis, ...extra }),
        dryRun: true,
      });

      expect(result.expiresOn).toBe(expiresOn);
    });

    it('lapses a YEAR_END lot earned before April at the end of that same March', async () => {
      const { client } = fakeDb({ slabs: [slab({ lss_factor: new Prisma.Decimal(1) })] });

      const result = await service.earn(client, bill({ docDate: '2027-02-10' }), {
        scheme: scheme({ expiryBasis: 'YEAR_END' }),
        dryRun: true,
      });

      expect(result.expiresOn).toBe('2027-03-31');
    });
  });

  // ═══ redeem ══════════════════════════════════════════════════════════════

  describe('redeem', () => {
    const tender = { tenderId: TENDER_ID, tenderAccYear: YEAR, points: 40, amount: 20 };
    const big = bill({ lines: [billLine(1, { netAmt: 1000 })] });

    it('does nothing for a tender of no points', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(service.redeem(client, big, { ...tender, points: 0 })).resolves.toEqual({
        rowsWritten: 0,
        points: 0,
        amount: 0,
        rate: 0,
      });
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('refuses a redemption with no member on the document', async () => {
      const { client } = fakeDb();

      expect(
        await refusalOf(service.redeem(client, bill({ memberId: null }), tender, { scheme: scheme() })),
      ).toMatchObject(refused(422, 'loyaltyMemberId'));
    });

    it('refuses when no scheme allows a redemption, asking for a REDEEM scheme', async () => {
      const { client, queryRaw } = fakeDb({ schemes: [] });

      expect(await refusalOf(service.redeem(client, big, tender))).toMatchObject(
        refused(422, 'loyaltyPoints'),
      );
      expect(statements(queryRaw, 'FROM sales.loyalty_scheme s')[0].values[1]).toEqual([
        'REDEEM',
        'BOTH',
      ]);
    });

    it('refuses under a scheme that does not allow point redemption', async () => {
      const { client } = fakeDb();

      expect(
        await refusalOf(
          service.redeem(client, big, tender, { scheme: scheme({ allowPointRedeem: false }) }),
        ),
      ).toMatchObject(refused(422, 'loyaltyPoints'));
    });

    it('refuses points earned at another branch under a branch pool', async () => {
      const { client, queryRaw } = fakeDb({ elsewhere: 2n });

      expect(
        await refusalOf(service.redeem(client, big, tender, { scheme: scheme({ poolMode: 'BRANCH', allowCrossBranchRedeem: false }) })),
      ).toMatchObject(refused(422, 'loyaltyPoints')); // prettier-ignore
      expect(statements(queryRaw, 'lld_branch_id <>')[0].values).toEqual([
        MEMBER_ID,
        ['EARN', 'OPENING', 'ADJUST', 'TRANSFER'],
        BRANCH_ID,
      ]);
    });

    it('does not look at other branches when the scheme allows cross-branch redemption', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 100, lots: [lotRow(LOT_A, 100, { lld_branch_id: OTHER_BRANCH })] });

      await service.redeem(client, big, tender, {
        scheme: scheme({ poolMode: 'BRANCH', allowCrossBranchRedeem: true }),
      }); // prettier-ignore

      expect(statements(queryRaw, 'lld_branch_id <>')).toEqual([]);
    });

    it('refuses when neither the scheme nor the tender master gives a rate', async () => {
      const { client } = fakeDb();

      expect(
        await refusalOf(
          service.redeem(client, big, { ...tender, masterRate: null }, { scheme: scheme({ redeemValuePerPoint: 0 }) }),
        ),
      ).toMatchObject(refused(422, 'loyaltyRate')); // prettier-ignore
    });

    it('falls back to the tender master’s rate only when the scheme has none', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 40, lots: [lotRow(LOT_A, 40)] });

      const result = await service.redeem(
        client,
        big,
        { ...tender, amount: 40, masterRate: 1 },
        { scheme: scheme({ redeemValuePerPoint: 0 }) },
      );

      expect(result).toEqual({ rowsWritten: 1, points: 40, amount: 40, rate: 1 });
      expect(ledgerRows(queryRaw)[0]).toMatchObject({ rate: '1.0000', moneyValue: '40.00' });
    });

    it('refuses a client amount that does not equal points × rate', async () => {
      const { client } = fakeDb();

      expect(
        await refusalOf(service.redeem(client, big, { ...tender, amount: 21 }, { scheme: scheme() })),
      ).toMatchObject(refused(422, 'tenderAmount'));
    });

    it.each([
      ['a bill below the redemption minimum', { redeemMinBillAmount: 1500 }, 'loyaltyPoints'],
      ['fewer points than the minimum', { minRedeemPoints: 50 }, 'loyaltyPoints'],
      ['more points than the maximum', { maxRedeemPoints: 30 }, 'loyaltyPoints'],
      ['more than the percentage cap of the bill', { maxRedeemPerc: 1.5 }, 'tenderAmount'],
      ['points off the redemption multiple', { redeemMultiple: 25 }, 'loyaltyPoints'],
    ])('refuses %s, before drawing any points', async (_label, caps, field) => {
      const { client, queryRaw } = fakeDb({ redeemable: 1000 });

      expect(
        await refusalOf(service.redeem(client, big, tender, { scheme: scheme(caps) })),
      ).toMatchObject(refused(422, field));
      expect(statements(queryRaw, 'SELECT lmb_comp_id, lmb_cust_id')).toEqual([]);
    });

    it('passes every cap it meets exactly', async () => {
      const { client } = fakeDb({ redeemable: 40, lots: [lotRow(LOT_A, 40)] });

      await expect(
        service.redeem(client, big, tender, {
          scheme: scheme({
            redeemMinBillAmount: 1000,
            minRedeemPoints: 40,
            maxRedeemPoints: 40,
            maxRedeemPerc: 2,
            redeemMultiple: 20,
          }),
        }),
      ).resolves.toMatchObject({ rowsWritten: 1 });
    });

    it('draws the points as REDEEM rows tied to the tender at the scheme’s rate', async () => {
      const { client, queryRaw } = fakeDb({
        redeemable: 100,
        lots: [lotRow(LOT_A, 25), lotRow(LOT_B, 75)],
      });

      const result = await service.redeem(client, big, tender, {
        scheme: scheme(),
        createdBy: 'cashier1',
      });

      expect(result).toEqual({ rowsWritten: 2, points: 40, amount: 20, rate: 0.5 });
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'REDEEM',
          points: '-25.0000',
          moneyValue: '12.50',
          tenderId: TENDER_ID,
          tenderAccYear: YEAR,
          srcDocId: BILL_ID,
          lscId: SCHEME_ID,
          createdBy: 'cashier1',
        }),
        expect.objectContaining({ points: '-15.0000', moneyValue: '7.50' }),
      ]);
    });
  });

  // ═══ undoing ═════════════════════════════════════════════════════════════

  const original = (id: string, type: string, points: number, overrides: Record<string, unknown> = {}) => ({
    lld_id: id,
    lld_acc_year: YEAR,
    lld_comp_id: COMPANY_ID,
    lld_branch_id: BRANCH_ID,
    lld_member_id: MEMBER_ID,
    lld_cust_id: CUST_ID,
    lld_txn_type: type,
    lld_points: new Prisma.Decimal(points),
    lld_lot_balance: null,
    lld_lot_id: null,
    lld_lot_acc_year: null,
    lld_lsc_id: SCHEME_ID,
    lld_rate: null,
    lld_money_value: null,
    lld_tender_id: null,
    lld_tender_acc_year: null,
    lld_txn_date: new Date('2026-10-19T00:00:00.000Z'),
    ...overrides,
  }); // prettier-ignore

  describe('reverseForCancel', () => {
    const doc = { docId: BILL_ID, accYear: YEAR, docType: 'SALE_BILL' as const, docRefno: 'bil00042' };

    it('does nothing for a document that moved no points', async () => {
      const { client, executeRaw } = fakeDb();

      await expect(service.reverseForCancel(client, doc)).resolves.toEqual({
        rowsWritten: 0,
        earnReversed: 0,
        redeemReversed: 0,
      });
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('takes back what is left of the EARN lot and gives back every REDEEM, naming each original', async () => {
      const { client, queryRaw, executeRaw } = fakeDb({
        originals: [
          original('earn-1', 'EARN', 40, { lld_lot_balance: new Prisma.Decimal(25) }),
          original('redeem-1', 'REDEEM', -10, {
            lld_lot_id: LOT_A,
            lld_lot_acc_year: YEAR,
            lld_rate: new Prisma.Decimal('0.5'),
            lld_money_value: new Prisma.Decimal(5),
            lld_tender_id: TENDER_ID,
            lld_tender_acc_year: YEAR,
          }),
        ],
        maxRowNos: [
          { lld_txn_type: 'EARN', max_row_no: 1 },
          { lld_txn_type: 'REDEEM', max_row_no: 1 },
        ],
      });

      const result = await service.reverseForCancel(client, doc, { createdBy: 'boss' });

      expect(result).toEqual({ rowsWritten: 2, earnReversed: 25, redeemReversed: 10 });
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'EARN',
          rowNo: 2,
          points: '-25.0000',
          lotId: null,
          reversalOfId: 'earn-1',
          reversalOfAccYear: YEAR,
          reversalReason: 'Document cancelled',
          remarks: 'Cancelled; 15 of 40 points had already been spent and could not be taken back',
          txnDate: '2026-10-19',
          createdBy: 'boss',
        }),
        expect.objectContaining({
          txnType: 'REDEEM',
          rowNo: 2,
          points: '10.0000',
          lotId: LOT_A,
          rate: '0.5000',
          moneyValue: '5.00',
          tenderId: TENDER_ID,
          reversalOfId: 'redeem-1',
          remarks: null,
        }),
      ]);
      // The EARN reversal names its lot only through lld_reversal_of_id, so that lot is recomputed too.
      // Lots are keyed in row order: the EARN reversal comes first, then the REDEEM's own lot.
      const [lotsUpdate] = statements(executeRaw, 'SET lld_consumed_points');
      expect(lotsUpdate.values).toEqual([
        ['earn-1', LOT_A],
        [YEAR, YEAR],
      ]);
    });

    it('skips an EARN fully spent and anything already reversed, so a repeated cancel is a no-op', async () => {
      const { client, queryRaw } = fakeDb({
        originals: [
          original('earn-1', 'EARN', 40, { lld_lot_balance: new Prisma.Decimal(0) }),
          original('gift-1', 'GIFT', -5),
          original('redeem-1', 'REDEEM', -10),
        ],
        reversed: ['redeem-1'],
      });

      const result = await service.reverseForCancel(client, doc, { reason: 'Wrong customer' });

      expect(result).toEqual({ rowsWritten: 1, earnReversed: 0, redeemReversed: 5 });
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'GIFT',
          rowNo: 1,
          points: '5.0000',
          reversalOfId: 'gift-1',
          reversalReason: 'Wrong customer',
        }),
      ]);
      expect(statements(queryRaw, 'SELECT DISTINCT lld_reversal_of_id')[0].values).toEqual([
        ['earn-1', 'gift-1', 'redeem-1'],
      ]);
    });
  });

  describe('reverseRedeemForTender', () => {
    const doc = {
      docId: BILL_ID,
      accYear: YEAR,
      docType: 'SALE_BILL' as const,
      docRefno: 'bil00042',
      tenderId: TENDER_ID,
    };

    it('restores only the voided tender’s REDEEM rows, continuing the numbering', async () => {
      const { client, queryRaw } = fakeDb({
        tenderOriginals: [
          original('r-1', 'REDEEM', -25, { lld_lot_id: LOT_A, lld_lot_acc_year: YEAR, lld_tender_id: TENDER_ID }),
          original('r-2', 'REDEEM', -15, { lld_lot_id: LOT_B, lld_lot_acc_year: YEAR, lld_tender_id: TENDER_ID }),
          original('r-3', 'REDEEM', -5, { lld_tender_id: TENDER_ID }),
        ],
        reversed: ['r-3'],
        maxRowNos: [{ lld_txn_type: 'REDEEM', max_row_no: 3 }],
      }); // prettier-ignore

      await expect(service.reverseRedeemForTender(client, doc)).resolves.toEqual({
        rowsWritten: 2,
        pointsRestored: 40,
      });
      expect(statements(queryRaw, 'lld_tender_id      =')[0].values).toEqual([
        'SALE_BILL',
        BILL_ID,
        TENDER_ID,
      ]);
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'REDEEM',
          rowNo: 4,
          points: '25.0000',
          lotId: LOT_A,
          reversalOfId: 'r-1',
          reversalReason: 'Tender voided',
        }),
        expect.objectContaining({ rowNo: 5, points: '15.0000', lotId: LOT_B, reversalOfId: 'r-2' }),
      ]);
    });

    it('does nothing when the tender redeemed no points', async () => {
      const { client, executeRaw } = fakeDb();

      await expect(service.reverseRedeemForTender(client, doc)).resolves.toEqual({
        rowsWritten: 0,
        pointsRestored: 0,
      });
      expect(executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('clawbackForReturn', () => {
    const ret = {
      docId: RETURN_ID,
      accYear: YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      docDate: '2026-10-20',
      docRefno: 'SR00001',
      memberId: MEMBER_ID,
    };

    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('takes nothing under a scheme whose returns are ignored', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(
        service.clawbackForReturn(client, ret, 1, {
          scheme: scheme({ returnMode: 'IGNORE' }),
          earnedOnBill: 40,
        }),
      ).resolves.toEqual({ rowsWritten: 0, clawedBack: 0, shortfall: 0 });
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('takes nothing when the bill earned nothing', async () => {
      const { client, queryRaw } = fakeDb();

      await expect(service.clawbackForReturn(client, ret, 0.5)).resolves.toEqual({
        rowsWritten: 0,
        clawedBack: 0,
        shortfall: 0,
      });
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('never aborts when the points were already spent — it reports the shortfall', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 0 });

      await expect(
        service.clawbackForReturn(client, ret, 0.5, { earnedOnBill: 40 }),
      ).resolves.toEqual({ rowsWritten: 0, clawedBack: 0, shortfall: 20 });
      expect(ledgerRows(queryRaw)).toEqual([]);
    });

    it('draws the returned share FIFO as EXPIRE rows keyed by the return, capped at what is left', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 30, lots: [lotRow(LOT_A, 30)] });

      // A share above 1 is clamped to the whole award.
      await expect(
        service.clawbackForReturn(client, ret, 1.4, { earnedOnBill: 40, createdBy: 'boss' }),
      ).resolves.toEqual({ rowsWritten: 1, clawedBack: 30, shortfall: 10 });
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'EXPIRE',
          rowNo: 1,
          points: '-30.0000',
          lotId: LOT_A,
          srcDocType: 'SALE_RETURN',
          srcDocId: RETURN_ID,
          srcDocRefno: 'SR00001',
          txnDate: '2026-10-20',
          remarks: 'Clawed back on return SR00001; 10 of 40 points had already been spent',
          createdBy: 'boss',
        }),
      ]);
    });

    it('words a full claw-back without a shortfall', async () => {
      const { client, queryRaw } = fakeDb({ redeemable: 50, lots: [lotRow(LOT_A, 50)] });

      await service.clawbackForReturn(client, ret, 0.25, { earnedOnBill: 40 });

      expect(ledgerRows(queryRaw)[0]).toMatchObject({
        points: '-10.0000',
        remarks: 'Clawed back on return SR00001',
      });
    });
  });

  // ═══ preview ═════════════════════════════════════════════════════════════

  describe('preview', () => {
    it('quotes the wallet, the redemption limits and the dry-run earning in one block', async () => {
      const { client, queryRaw } = fakeDb({
        balance: 120,
        redeemable: 90,
        slabs: [slab({ lss_factor: new Prisma.Decimal('0.1') })],
        schemes: [
          {
            lsc_id: SCHEME_ID, lsc_code: 'GOLD', lsc_name: 'Gold rewards', lsc_type: 'BOTH',
            lsc_priority: 1, lsc_apply_on: 'BILL_AMOUNT', lsc_calc_on_amount_type: 'NET_AMOUNT',
            lsc_include_tax: true, lsc_bill_type: 'ALL', lsc_item_scope: 'ALL',
            lsc_branch_scope: 'ALL', lsc_cust_scope: 'ALL', lsc_min_bill_amount: null,
            lsc_max_earn_points: null, lsc_earn_on_discounted: true, lsc_earn_on_charges: false,
            lsc_earn_with_redeem: true, lsc_rounding_method: 'FLOOR', lsc_points_decimals: 0,
            lsc_allow_point_redeem: true, lsc_redeem_value_per_point: new Prisma.Decimal('0.5'),
            lsc_min_redeem_points: new Prisma.Decimal(10), lsc_max_redeem_points: new Prisma.Decimal(500),
            lsc_max_redeem_perc: new Prisma.Decimal(20), lsc_redeem_min_bill_amount: null,
            lsc_redeem_multiple: new Prisma.Decimal(5), lsc_redeem_tender_id: null,
            lsc_expiry_basis: 'NONE', lsc_points_valid_days: null, lsc_activation_days: 0,
            lsc_return_mode: 'REVERSE', lsc_start_date: null, lsc_end_date: null,
            lsc_pool_mode: null, lsc_allow_cross_branch_redeem: true,
          },
        ],
      }); // prettier-ignore

      await expect(
        service.preview(bill({ chargesAmt: 50, lines: [billLine(1, { netAmt: 250 })] }), client),
      ).resolves.toEqual({
        memberId: MEMBER_ID,
        balance: 120,
        redeemable: 90,
        rate: 0.5,
        minPoints: 10,
        maxPoints: 500,
        maxRedeemAmount: 60,
        multiple: 5,
        earnPreview: 25,
        schemeId: SCHEME_ID,
        schemeName: 'Gold rewards',
        allowPointRedeem: true,
      });
      expect(ledgerRows(queryRaw)).toEqual([]);
    });

    it('answers an empty block for no member and no scheme', async () => {
      const { client } = fakeDb({ schemes: [] });

      await expect(service.preview(bill({ memberId: null }), client)).resolves.toEqual({
        memberId: null,
        balance: 0,
        redeemable: 0,
        rate: 0,
        minPoints: 0,
        maxPoints: null,
        maxRedeemAmount: null,
        multiple: null,
        earnPreview: 0,
        schemeId: null,
        schemeName: null,
        allowPointRedeem: false,
      });
    });
  });

  // ═══ the nightly sweeps ══════════════════════════════════════════════════

  describe('expiryRun', () => {
    it('sweeps each lapsed lot into an EXPIRE row under a run id fixed by company and day', async () => {
      const { tx, queryRaw } = fakeDb({
        lapsed: [
          original(LOT_A, 'EARN', 40, { lld_lot_balance: new Prisma.Decimal(12) }),
          original(LOT_B, 'OPENING', 10, { lld_lot_balance: new Prisma.Decimal(10), lld_lsc_id: null }),
        ],
      }); // prettier-ignore
      prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      await expect(service.expiryRun(COMPANY_ID, YEAR, '2026-10-19', 'night-job')).resolves.toBe(2);

      // md5('<company>|2026-10-19') laid out as a uuid — the recipe the till also derives.
      const runId = '6991f2f2-667d-43bf-b437-e267a91b5be6';
      expect(statements(queryRaw, 'lld_expires_on < ')[0].values).toEqual([
        COMPANY_ID,
        ['EARN', 'OPENING', 'ADJUST', 'TRANSFER'],
        '2026-10-19',
      ]);
      expect(ledgerRows(queryRaw)).toEqual([
        expect.objectContaining({
          txnType: 'EXPIRE',
          rowNo: 1,
          points: '-12.0000',
          lotId: LOT_A,
          lscId: SCHEME_ID,
          txnDate: '2026-10-19',
          srcDocType: 'EXPIRY_RUN',
          srcDocId: runId,
          remarks: 'Lapsed on 2026-10-19',
          createdBy: 'night-job',
        }),
        expect.objectContaining({ rowNo: 2, points: '-10.0000', lotId: LOT_B, lscId: null, srcDocId: runId }),
      ]); // prettier-ignore
    });

    it('writes nothing when nothing has lapsed', async () => {
      const { tx, queryRaw, executeRaw } = fakeDb();
      prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      await expect(service.expiryRun(COMPANY_ID, YEAR, '2026-10-19')).resolves.toBe(0);
      expect(ledgerRows(queryRaw)).toEqual([]);
      expect(executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('couponExpiryRun', () => {
    const coupon = (id: string, overrides: Record<string, unknown> = {}) => ({
      lcp_id: id,
      lcp_acc_year: YEAR,
      lcp_comp_id: COMPANY_ID,
      lcp_branch_id: BRANCH_ID,
      lcb_branch_id: OTHER_BRANCH,
      lcp_lcb_id: 'batch-1',
      lcp_cust_id: CUST_ID,
      lcp_member_id: null,
      lcp_balance_value: new Prisma.Decimal('250'),
      ...overrides,
    });

    it('writes the lapsed balance as a POSITIVE EXPIRE movement, recomputes, THEN marks EXPIRED', async () => {
      const { tx, executeRaw } = fakeDb({
        lapsedCoupons: [coupon('cp-1'), coupon('cp-2', { lcp_branch_id: null })],
      });
      prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      await expect(service.couponExpiryRun(COMPANY_ID, YEAR, '2026-10-19')).resolves.toBe(2);

      const [insert] = statements(executeRaw, 'INSERT INTO sales.loyalty_coupon_txn');
      expect(decode(insert.values, COUPON_FIELDS)).toEqual([
        expect.objectContaining({
          branchId: BRANCH_ID,
          lcpId: 'cp-1',
          lcbId: 'batch-1',
          txnType: 'EXPIRE',
          rowNo: 1,
          amount: '250.00',
          srcDocType: 'EXPIRY_RUN',
          // md5('<company>|coupon|2026-10-19') — never the points sweep's id.
          srcDocId: '87d970e4-1b33-5e0d-4bb2-cb6b3d0372c1',
          createdBy: 'SYSTEM',
        }),
        // A voucher issued without a branch files under its batch's.
        expect.objectContaining({ branchId: OTHER_BRANCH, lcpId: 'cp-2' }),
      ]);
      const order = executeRaw.mock.calls.map(sqlOf);
      expect(order[0]).toContain('INSERT INTO sales.loyalty_coupon_txn');
      expect(order[1]).toContain('UPDATE sales.loyalty_coupon c');
      expect(order[2]).toContain('UPDATE sales.loyalty_coupon_batch b');
      expect(order[3]).toContain("lcp_status      = 'EXPIRED'");
      expect(statements(executeRaw, "lcp_status      = 'EXPIRED'")[0].values).toEqual([
        'SYSTEM',
        ['cp-1', 'cp-2'],
      ]);
      expect(statements(executeRaw, 'UPDATE sales.loyalty_coupon_batch b')[0].values).toEqual([
        ['batch-1'],
      ]);
    });

    it('writes nothing when no voucher has lapsed', async () => {
      const { tx, executeRaw } = fakeDb();
      prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      await expect(service.couponExpiryRun(COMPANY_ID, YEAR, '2026-10-19')).resolves.toBe(0);
      expect(executeRaw).not.toHaveBeenCalled();
    });
  });
});
