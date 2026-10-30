import { Logger, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MONEY_LINE_SRC_DOC_TYPE,
  MoneyLineScope,
  coverMoneyLines,
  coverPostedVoucher,
  retireMoneyLineRows,
} from './money-lines';

const VOUCHER_ID = '019f0000-0000-7000-8000-0000000000a1';
const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';
const USER_ID = '019f0000-0000-7000-8000-0000000000e1';
const PARTY_ID = '019f0000-0000-7000-8000-0000000000d1';
const BILL_ID = '019f0000-0000-7000-8000-0000000000b1';
const VOIDED_TD_ID = '019f0000-0000-7000-8000-0000000000b9';

const TILL = '019f0000-0000-7000-8000-000000000101';
const SAFE = '019f0000-0000-7000-8000-000000000102';
const HDFC = '019f0000-0000-7000-8000-000000000103';
const SALES = '019f0000-0000-7000-8000-000000000104';
const EXPENSE = '019f0000-0000-7000-8000-000000000105';

const CASH_TENDER = '019f0000-0000-7000-8000-000000000201';
const HDFC_NEFT = '019f0000-0000-7000-8000-000000000202';
const CHEQUE_TENDER = '019f0000-0000-7000-8000-000000000203';
const UPI_TENDER = '019f0000-0000-7000-8000-000000000204';

type Side = 'DR' | 'CR';
type Ledger = { led_id: string; led_name: string; kind: 'CASH' | 'BANK' };

const LEDGERS: Ledger[] = [
  { led_id: TILL, led_name: 'Till 1', kind: 'CASH' },
  { led_id: SAFE, led_name: 'Safe', kind: 'CASH' },
  { led_id: HDFC, led_name: 'HDFC Bank', kind: 'BANK' },
];

/** The columns of the acc_tender_detail INSERT, in the order the writer binds them. */
const INSERT_COLUMNS = [
  'companyId',
  'branchId',
  'tenantId',
  'accYear',
  'srcModule',
  'srcDocType',
  'srcDocId',
  'rowNo',
  'docDate',
  'partyLedgerId',
  'voucherId',
  'tenderId',
  'tenderTypeId',
  'tenderLedgerId',
  'drCr',
  'amount',
  'totalAmt',
  'sessionId',
  'deviceId',
  'userId',
  'createdBy',
] as const;
type InsertedRow = Record<(typeof INSERT_COLUMNS)[number], unknown>;

/**
 * A transaction that answers each raw read by what it selects. `covered` are
 * the already-written tender rows (per ledger and side), `tenders` the masters
 * per tender type id.
 */
const makeTx = (
  options: {
    covered?: { led: string; side: Side; amt: string }[];
    voided?: { led: string; side: Side; amt: string } | null;
    tenders?: Record<number, string[]>;
    named?: Record<string, number>;
    maxRowNo?: number;
    header?: Record<string, string | null> | null;
    postedLegs?: { ledger_id: string; dr_cr: Side; amount: Prisma.Decimal }[];
  } = {},
) => {
  const inserted: InsertedRow[] = [];
  const reads: { sql: string; values: unknown[] }[] = [];
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      reads.push({ sql, values });
      if (sql.includes('FROM accounts.acc_ledger_master')) {
        const ids = values[0] as string[];
        return LEDGERS.filter((l) => ids.includes(l.led_id));
      }
      if (sql.includes('sum(t.td_amount)')) {
        return (options.covered ?? []).map((c) => ({ ...c, amt: new Prisma.Decimal(c.amt) }));
      }
      if (sql.includes('WHERE td_id =')) {
        const v = options.voided;
        return v ? [{ ...v, amt: new Prisma.Decimal(v.amt) }] : [];
      }
      if (sql.includes('tnd_type_id AS type_id')) {
        const typeId = options.named?.[values[0] as string];
        return typeId === undefined ? [] : [{ type_id: typeId }];
      }
      if (sql.includes('FROM accounts.acc_tender_master')) {
        const typeId = values[2] as number;
        return (options.tenders?.[typeId] ?? []).map((tnd_id) => ({ tnd_id }));
      }
      if (sql.includes('max(td_row_no)')) {
        return [{ n: options.maxRowNo ?? 0 }];
      }
      if (sql.includes('FROM accounts.acc_voucher_header')) {
        return options.header ? [options.header] : [];
      }
      if (sql.includes('FROM accounts.acc_vouchers')) {
        return options.postedLegs ?? [];
      }
      throw new Error(`unexpected read: ${sql}`);
    }),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('?').includes('INSERT INTO accounts.acc_tender_detail')) {
        inserted.push(
          Object.fromEntries(INSERT_COLUMNS.map((c, i) => [c, values[i]])) as InsertedRow,
        );
      }
      return 1;
    }),
  };
  return { tx, inserted, reads, client: tx as unknown as Prisma.TransactionClient };
};

const scope = (overrides: Partial<MoneyLineScope> = {}): MoneyLineScope => ({
  voucherId: VOUCHER_ID,
  accYear: '2026-2027',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  voucherDate: '2026-10-23',
  userId: USER_ID,
  ...overrides,
});

const DEFAULT_TENDERS = { 1: [CASH_TENDER], 5: [CHEQUE_TENDER], 6: [HDFC_NEFT] };

describe('coverMoneyLines', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('labels an uncovered cash line with the branch CASH tender', async () => {
    const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

    const result = await coverMoneyLines(client, scope({ srcModule: 'TILL' }), [
      { ledgerId: SAFE, drCr: 'DR', amount: 500 },
      { ledgerId: TILL, drCr: 'CR', amount: 500 },
    ]);

    expect(result).toEqual({ written: 2, gaps: [] });
    expect(inserted[0]).toMatchObject({
      srcModule: 'TILL',
      srcDocType: MONEY_LINE_SRC_DOC_TYPE,
      srcDocId: VOUCHER_ID,
      voucherId: VOUCHER_ID,
      rowNo: 1,
      tenderId: CASH_TENDER,
      tenderTypeId: 1,
      tenderLedgerId: SAFE,
      drCr: 'DR',
      amount: '500.00',
      totalAmt: '500.00',
      userId: USER_ID,
      createdBy: 'SYSTEM',
    });
    expect(inserted[1]).toMatchObject({ tenderLedgerId: TILL, drCr: 'CR', rowNo: 2 });
  });

  it('ignores the legs that are not on a cash or bank ledger', async () => {
    const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

    await coverMoneyLines(client, scope(), [
      { ledgerId: EXPENSE, drCr: 'DR', amount: 100 },
      { ledgerId: TILL, drCr: 'CR', amount: 100 },
    ]);

    expect(inserted.map((r) => r.tenderLedgerId)).toEqual([TILL]);
  });

  it('writes nothing, and reads no more, when no leg is a money line', async () => {
    const { client, tx } = makeTx();

    await expect(
      coverMoneyLines(client, scope(), [
        { ledgerId: EXPENSE, drCr: 'DR', amount: 100 },
        { ledgerId: SALES, drCr: 'CR', amount: 100 },
      ]),
    ).resolves.toEqual({ written: 0, gaps: [] });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('skips zero legs and legs with no ledger without a query', async () => {
    const { client, tx } = makeTx();

    await expect(
      coverMoneyLines(client, scope(), [
        { ledgerId: TILL, drCr: 'DR', amount: 0 },
        { ledgerId: '', drCr: 'CR', amount: 10 },
      ]),
    ).resolves.toEqual({ written: 0, gaps: [] });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('sums legs on the same ledger and side into one row', async () => {
    const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

    await coverMoneyLines(client, scope(), [
      { ledgerId: TILL, drCr: 'DR', amount: '100.10' },
      { ledgerId: TILL, drCr: 'DR', amount: new Prisma.Decimal('49.90') },
      { ledgerId: SALES, drCr: 'CR', amount: 150 },
    ]);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].amount).toBe('150.00');
  });

  it('writes only the part the voucher’s own tender rows do not already cover', async () => {
    const { client, inserted } = makeTx({
      tenders: DEFAULT_TENDERS,
      covered: [{ led: TILL, side: 'DR', amt: '60.00' }],
    });

    await coverMoneyLines(client, scope(), [{ ledgerId: TILL, drCr: 'DR', amount: 100 }]);

    expect(inserted[0].amount).toBe('40.00');
  });

  it('writes nothing for a line already fully covered — or over-covered', async () => {
    const { client, inserted } = makeTx({
      tenders: DEFAULT_TENDERS,
      covered: [{ led: TILL, side: 'DR', amt: '120.00' }],
    });

    await expect(
      coverMoneyLines(client, scope(), [{ ledgerId: TILL, drCr: 'DR', amount: 100 }]),
    ).resolves.toEqual({ written: 0, gaps: [] });
    expect(inserted).toHaveLength(0);
  });

  it('does not let a row on the other side cover the line', async () => {
    const { client, inserted } = makeTx({
      tenders: DEFAULT_TENDERS,
      covered: [{ led: TILL, side: 'CR', amt: '100.00' }],
    });

    await coverMoneyLines(client, scope(), [{ ledgerId: TILL, drCr: 'DR', amount: 100 }]);

    expect(inserted[0]).toMatchObject({ drCr: 'DR', amount: '100.00' });
  });

  it('numbers its rows after the ones the voucher already has', async () => {
    const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS, maxRowNo: 3 });

    await coverMoneyLines(client, scope(), [{ ledgerId: TILL, drCr: 'DR', amount: 1 }]);

    expect(inserted[0].rowNo).toBe(4);
  });

  describe('a bank line', () => {
    it('is a gap unless the module says how the money moved', async () => {
      const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

      const result = coverMoneyLines(client, scope({ docLabel: 'Receipt RcpV/7' }), [
        { ledgerId: HDFC, drCr: 'DR', amount: 1000 },
      ]);

      await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(result).rejects.toMatchObject({
        response: {
          success: false,
          message: 'Receipt RcpV/7 has a cash / bank line with no tender',
          errors: [{ field: 'tender', code: 'VCH_MONEY_LINE_NO_TENDER' }],
        },
      });
      expect(inserted).toHaveLength(0);
    });

    it('takes the bank’s own BANK tender for a remittance or payout', async () => {
      const { client, inserted, reads } = makeTx({ tenders: DEFAULT_TENDERS });

      await coverMoneyLines(client, scope({ bankTender: 'BANK' }), [
        { ledgerId: HDFC, drCr: 'DR', amount: 1000 },
      ]);

      expect(inserted[0]).toMatchObject({ tenderId: HDFC_NEFT, tenderTypeId: 6 });
      const pick = reads.find((r) => r.sql.includes('FROM accounts.acc_tender_master'));
      // The BANK pick is narrowed to tenders pointing at this very ledger.
      expect(pick?.values).toContain(HDFC);
    });

    it('takes the CHEQUE tender for a clearing or bounce', async () => {
      const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

      await coverMoneyLines(client, scope({ bankTender: 'CHEQUE' }), [
        { ledgerId: HDFC, drCr: 'CR', amount: 1000 },
      ]);

      expect(inserted[0]).toMatchObject({ tenderId: CHEQUE_TENDER, tenderTypeId: 5 });
    });

    it('refuses to guess between two BANK tenders on the same ledger', async () => {
      const { client } = makeTx({ tenders: { 6: [HDFC_NEFT, UPI_TENDER] } });

      const result = coverMoneyLines(client, scope({ bankTender: 'BANK' }), [
        { ledgerId: HDFC, drCr: 'DR', amount: 1 },
      ]);

      await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(result).rejects.toMatchObject({
        response: {
          errors: [
            {
              code: 'VCH_MONEY_LINE_NO_TENDER',
              message: 'More than one BANK tender points at HDFC Bank: the line must name which one',
            },
          ],
        },
      });
    });

    it('names the ledger when it has no BANK tender at all', async () => {
      const { client } = makeTx({ tenders: {} });

      await expect(
        coverMoneyLines(client, scope({ bankTender: 'BANK' }), [
          { ledgerId: HDFC, drCr: 'DR', amount: 1 },
        ]),
      ).rejects.toMatchObject({
        response: {
          errors: [
            {
              code: 'VCH_NO_TENDER_FOR_LEDGER',
              message: expect.stringContaining('HDFC Bank has no BANK tender'),
            },
          ],
        },
      });
    });
  });

  it('refuses a cash line when the branch has no CASH tender', async () => {
    const { client } = makeTx({ tenders: {} });

    await expect(
      coverMoneyLines(client, scope(), [{ ledgerId: TILL, drCr: 'DR', amount: 1 }]),
    ).rejects.toMatchObject({
      response: {
        message: 'The voucher has a cash / bank line with no tender',
        errors: [
          {
            code: 'VCH_NO_TENDER_FOR_LEDGER',
            message: 'No active CASH tender in this branch for Till 1: create it in Tender Master',
          },
        ],
      },
    });
  });

  it('uses the tender the document named for that ledger and side first', async () => {
    const { client, inserted, reads } = makeTx({
      tenders: DEFAULT_TENDERS,
      named: { [UPI_TENDER]: 7 },
    });

    await coverMoneyLines(
      client,
      scope({ tenders: [{ ledgerId: HDFC, drCr: 'DR', tenderId: UPI_TENDER }] }),
      [{ ledgerId: HDFC, drCr: 'DR', amount: 250 }],
    );

    expect(inserted[0]).toMatchObject({ tenderId: UPI_TENDER, tenderTypeId: 7 });
    expect(reads.some((r) => r.sql.includes('tnd_type_id = '))).toBe(false);
  });

  it('refuses a named tender that is not live', async () => {
    const { client } = makeTx({ tenders: DEFAULT_TENDERS, named: {} });

    await expect(
      coverMoneyLines(
        client,
        scope({ tenders: [{ ledgerId: TILL, drCr: 'DR', tenderId: UPI_TENDER }] }),
        [{ ledgerId: TILL, drCr: 'DR', amount: 1 }],
      ),
    ).rejects.toMatchObject({
      response: { errors: [{ message: `Tender ${UPI_TENDER} is not a live tender` }] },
    });
  });

  // The counter is never refused (the user's rule).
  it('only logs the gaps of a SALES document, and returns them', async () => {
    const { client, inserted } = makeTx({ tenders: { 1: [CASH_TENDER] } });

    const result = await coverMoneyLines(
      client,
      scope({ srcModule: 'sales', docLabel: 'Bill SB/41' }),
      [
        { ledgerId: TILL, drCr: 'DR', amount: 100 },
        { ledgerId: HDFC, drCr: 'DR', amount: 18 },
        { ledgerId: SALES, drCr: 'CR', amount: 118 },
      ],
    );

    expect(result.written).toBe(1);
    expect(result.gaps).toEqual([
      expect.objectContaining({
        ledgerId: HDFC,
        ledgerName: 'HDFC Bank',
        ledgerType: 'BANK',
        drCr: 'DR',
        amount: 18,
        code: 'VCH_MONEY_LINE_NO_TENDER',
      }),
    ]);
    expect(inserted).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      `Bill SB/41 ${VOUCHER_ID}: HDFC Bank DR 18.00 (VCH_MONEY_LINE_NO_TENDER) — no tender`,
    );
  });

  describe('the party on the row', () => {
    it("is the voucher's party when it has one", async () => {
      const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

      await coverMoneyLines(client, scope({ partyId: PARTY_ID }), [
        { ledgerId: TILL, drCr: 'DR', amount: 1 },
        { ledgerId: SALES, drCr: 'CR', amount: 1 },
      ]);

      expect(inserted[0].partyLedgerId).toBe(PARTY_ID);
    });

    it('is otherwise the biggest leg on the other side', async () => {
      const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

      await coverMoneyLines(client, scope(), [
        { ledgerId: SAFE, drCr: 'DR', amount: 700 },
        { ledgerId: TILL, drCr: 'CR', amount: 500 },
        { ledgerId: EXPENSE, drCr: 'CR', amount: 200 },
      ]);

      const safeRow = inserted.find((r) => r.tenderLedgerId === SAFE);
      const tillRow = inserted.find((r) => r.tenderLedgerId === TILL);
      expect(safeRow?.partyLedgerId).toBe(TILL);
      expect(tillRow?.partyLedgerId).toBe(SAFE);
    });

    it('is the line’s own ledger when nothing sits on the other side', async () => {
      const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

      await coverMoneyLines(client, scope(), [{ ledgerId: TILL, drCr: 'DR', amount: 1 }]);

      expect(inserted[0].partyLedgerId).toBe(TILL);
    });
  });

  it.each([
    [undefined, 'ACCOUNTS'],
    ['TILL', 'TILL'],
    ['Sales', 'SALES'],
    ['PURCHASE', 'ACCOUNTS'],
  ])('files a %s voucher under td_src_module %s', async (srcModule, expected) => {
    const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

    await coverMoneyLines(client, scope({ srcModule }), [{ ledgerId: TILL, drCr: 'DR', amount: 1 }]);

    expect(inserted[0].srcModule).toBe(expected);
  });

  it('cuts the creator to 50 characters', async () => {
    const { client, inserted } = makeTx({ tenders: DEFAULT_TENDERS });

    await coverMoneyLines(client, scope({ createdBy: 'x'.repeat(60) }), [
      { ledgerId: TILL, drCr: 'DR', amount: 1 },
    ]);

    expect(inserted[0].createdBy).toBe('x'.repeat(50));
  });

  describe('what counts as covered', () => {
    it("counts the document's own rows on an ordinary voucher", async () => {
      const { client, reads } = makeTx({ tenders: DEFAULT_TENDERS });

      await coverMoneyLines(client, scope({ srcDocType: 'SALE_BILL', srcDocId: BILL_ID }), [
        { ledgerId: TILL, drCr: 'DR', amount: 1 },
      ]);

      const covered = reads.find((r) => r.sql.includes('sum(t.td_amount)'));
      // voucherId twice, then the replaced row (none) and the document's own id.
      expect(covered?.values).toEqual([VOUCHER_ID, VOUCHER_ID, null, BILL_ID]);
    });

    it('counts, for a re-tender contra, the rows that replaced the voided one and the voided row reversed', async () => {
      const { client, inserted, reads } = makeTx({
        tenders: DEFAULT_TENDERS,
        covered: [{ led: HDFC, side: 'DR', amt: '100.00' }],
        voided: { led: TILL, side: 'DR', amt: '100.00' },
      });

      // Cash 100 taken back off the till (CR), re-tendered by card on the bank (DR).
      const result = await coverMoneyLines(
        client,
        scope({ srcDocType: 'SALE_BILL_RETENDER', srcDocId: VOIDED_TD_ID, srcModule: 'SALES' }),
        [
          { ledgerId: HDFC, drCr: 'DR', amount: 100 },
          { ledgerId: TILL, drCr: 'CR', amount: 100 },
        ],
      );

      expect(result).toEqual({ written: 0, gaps: [] });
      expect(inserted).toHaveLength(0);
      const covered = reads.find((r) => r.sql.includes('sum(t.td_amount)'));
      expect(covered?.values).toEqual([VOUCHER_ID, VOUCHER_ID, VOIDED_TD_ID, null]);
    });
  });
});

describe('coverPostedVoucher', () => {
  const header = {
    company_id: COMPANY_ID,
    branch_id: BRANCH_ID,
    tenant_id: null,
    voucher_date: '2026-10-23',
    src_module: 'ACCOUNTS',
    src_doc_type: null,
    src_doc_id: null,
    party_id: PARTY_ID,
    session_id: null,
    device_id: 'POS-1',
    user_id: USER_ID,
    refno: 'PmtV/12',
    created_by: 'cashier1',
  };

  it('reads the header and legs back and covers them', async () => {
    const { client, inserted } = makeTx({
      tenders: DEFAULT_TENDERS,
      header,
      postedLegs: [
        { ledger_id: TILL, dr_cr: 'CR', amount: new Prisma.Decimal(300) },
        { ledger_id: EXPENSE, dr_cr: 'DR', amount: new Prisma.Decimal(300) },
      ],
    });

    await expect(
      coverPostedVoucher(client, { voucherId: VOUCHER_ID, accYear: '2026-2027' }),
    ).resolves.toEqual({ written: 1, gaps: [] });
    expect(inserted[0]).toMatchObject({
      tenderLedgerId: TILL,
      drCr: 'CR',
      amount: '300.00',
      partyLedgerId: PARTY_ID,
      deviceId: 'POS-1',
      createdBy: 'cashier1',
      srcModule: 'ACCOUNTS',
    });
  });

  it('names the voucher by its refno in a refusal', async () => {
    const { client } = makeTx({
      tenders: DEFAULT_TENDERS,
      header,
      postedLegs: [{ ledger_id: HDFC, dr_cr: 'CR', amount: new Prisma.Decimal(10) }],
    });

    await expect(
      coverPostedVoucher(client, { voucherId: VOUCHER_ID, accYear: '2026-2027' }),
    ).rejects.toMatchObject({
      response: { message: 'Voucher PmtV/12 has a cash / bank line with no tender' },
    });
  });

  it('passes the caller’s bank tender and creator through', async () => {
    const { client, inserted } = makeTx({
      tenders: DEFAULT_TENDERS,
      header,
      postedLegs: [{ ledger_id: HDFC, dr_cr: 'CR', amount: new Prisma.Decimal(10) }],
    });

    await coverPostedVoucher(
      client,
      { voucherId: VOUCHER_ID, accYear: '2026-2027' },
      { bankTender: 'CHEQUE', createdBy: 'clerk' },
    );

    expect(inserted[0]).toMatchObject({ tenderTypeId: 5, createdBy: 'clerk' });
  });

  it('does nothing for a voucher that is not there, or has no user', async () => {
    const missing = makeTx({ header: null });
    const noUser = makeTx({ header: { ...header, user_id: null } });

    await expect(
      coverPostedVoucher(missing.client, { voucherId: VOUCHER_ID, accYear: '2026-2027' }),
    ).resolves.toEqual({ written: 0, gaps: [] });
    await expect(
      coverPostedVoucher(noUser.client, { voucherId: VOUCHER_ID, accYear: '2026-2027' }),
    ).resolves.toEqual({ written: 0, gaps: [] });
    expect(noUser.tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('retireMoneyLineRows', () => {
  it('soft-deletes only the server-written rows of the voucher', async () => {
    const { client, tx } = makeTx();

    await retireMoneyLineRows(client, VOUCHER_ID, 'a'.repeat(70));

    const [strings, ...values] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?')).toContain('SET td_is_deleted = true');
    expect(values).toEqual(['a'.repeat(50), VOUCHER_ID, MONEY_LINE_SRC_DOC_TYPE]);
  });
});
