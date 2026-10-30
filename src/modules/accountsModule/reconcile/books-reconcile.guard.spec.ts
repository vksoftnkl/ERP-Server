import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACC_CHEQUES_OUT_OF_BALANCE,
  ACC_PARTY_OUT_OF_BALANCE,
  assertBooksReconcile,
  RECONCILE_ON_POST_SETTING,
} from './books-reconcile.guard';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fc01';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46fc02';
const OTHER_PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46fc03';
const IN_HAND_ID = '019c6f6c-be87-7a11-8905-36092c46fc04';
const SALES_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fc05';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46fc06';
const APD_ID = '019c6f6c-be87-7a11-8905-36092c46fc07';
const ACC_YEAR = '2026-2027';

type LedgerRow = { led_id: string; led_name: string; bill_by_bill: boolean; in_hand: boolean };
type ReconcileRow = Record<string, Prisma.Decimal>;

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

const dec = (value: string) => new Prisma.Decimal(value);

const partyRow = (ledger: string, bills: string): ReconcileRow => ({
  ledger_bal: dec(ledger),
  bills_bal: dec(bills),
  diff: dec(ledger).minus(dec(bills)),
});

const chequeRow = (ledger: string, register: string): ReconcileRow => ({
  ledger_bal: dec(ledger),
  register_bal: dec(register),
  diff: dec(ledger).minus(dec(register)),
});

describe('assertBooksReconcile', () => {
  let answers: {
    setting: { value: string | null }[];
    ledgers: LedgerRow[];
    voucherLedgers: { id: string }[];
    chequeLedgers: { id: string | null }[];
    party: Record<string, ReconcileRow | undefined>;
    inHand: Record<string, ReconcileRow | undefined>;
  };
  let queryRaw: jest.Mock;
  let tx: Prisma.TransactionClient;

  /** Every raw statement the guard ran, as its SQL text and bound values. */
  const statements = () =>
    queryRaw.mock.calls.map(([strings, ...values]: unknown[]) => ({
      sql: (strings as TemplateStringsArray).join('?'),
      values,
    }));
  const statementsLike = (fragment: string) => statements().filter((s) => s.sql.includes(fragment));

  beforeEach(() => {
    answers = {
      setting: [{ value: 'true' }],
      ledgers: [],
      voucherLedgers: [],
      chequeLedgers: [],
      party: {},
      inHand: {},
    };
    queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('fn_app_settings_effective')) return Promise.resolve(answers.setting);
      if (sql.includes('acc_pdc_register')) return Promise.resolve(answers.chequeLedgers);
      if (sql.includes('SELECT DISTINCT av_ledger_id')) {
        return Promise.resolve(answers.voucherLedgers);
      }
      if (sql.includes('FROM accounts.acc_ledger_master')) {
        const ids = values[0] as string[];
        return Promise.resolve(answers.ledgers.filter((l) => ids.includes(l.led_id)));
      }
      if (sql.includes('fn_party_bill_reconcile')) {
        const row = answers.party[values[1] as string];
        return Promise.resolve(row ? [row] : []);
      }
      if (sql.includes('fn_cheques_in_hand_reconcile')) {
        const row = answers.inHand[values[1] as string];
        return Promise.resolve(row ? [row] : []);
      }
      return Promise.reject(new Error(`unexpected SQL: ${sql}`));
    });
    tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
  });

  const party = (overrides: Partial<LedgerRow> = {}): LedgerRow => ({
    led_id: PARTY_ID,
    led_name: 'Ravi Traders',
    bill_by_bill: true,
    in_hand: false,
    ...overrides,
  });
  const inHand = (overrides: Partial<LedgerRow> = {}): LedgerRow => ({
    led_id: IN_HAND_ID,
    led_name: 'Cheques In Hand',
    bill_by_bill: false,
    in_hand: true,
    ...overrides,
  });

  describe('the accounts.reconcile_on_post switch', () => {
    it('reads the effective COMPANY value of the setting through the resolver', async () => {
      await assertBooksReconcile(tx, { companyId: COMPANY_ID, accYear: ACC_YEAR });

      const [setting] = statementsLike('fn_app_settings_effective');
      expect(setting.values).toEqual([COMPANY_ID, RECONCILE_ON_POST_SETTING]);
    });

    it.each([['false'], ['0'], ['no'], ['off'], [''], ['maybe']])(
      'reads %p as OFF and checks nothing',
      async (value) => {
        answers.setting = [{ value }];
        answers.ledgers = [party()];
        answers.party[PARTY_ID] = partyRow('500', '0');

        await expect(
          assertBooksReconcile(tx, {
            companyId: COMPANY_ID,
            accYear: ACC_YEAR,
            ledgerIds: [PARTY_ID],
          }),
        ).resolves.toBeUndefined();
        expect(queryRaw).toHaveBeenCalledTimes(1);
      },
    );

    it('reads a missing setting row (migration not applied) as OFF', async () => {
      answers.setting = [];

      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [PARTY_ID],
      });

      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('reads a null value as OFF', async () => {
      answers.setting = [{ value: null }];

      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [PARTY_ID],
      });

      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it.each([['true'], [' TRUE '], ['1'], ['yes'], ['Y'], ['on']])(
      'reads %p as ON',
      async (value) => {
        answers.setting = [{ value }];

        await assertBooksReconcile(tx, {
          companyId: COMPANY_ID,
          accYear: ACC_YEAR,
          ledgerIds: [PARTY_ID],
        });

        expect(statementsLike('FROM accounts.acc_ledger_master')).toHaveLength(1);
      },
    );
  });

  describe('which ledgers are in scope', () => {
    it('reads no ledger when the post named nothing', async () => {
      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [null, undefined, ''],
        vouchers: [null, undefined],
        cheques: [null],
      });

      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('drops blank ids and repeats from the named ledgers', async () => {
      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [PARTY_ID, null, PARTY_ID, '', OTHER_PARTY_ID],
      });

      const [ledgerRead] = statementsLike('FROM accounts.acc_ledger_master');
      expect(ledgerRead.values[0]).toEqual([PARTY_ID, OTHER_PARTY_ID]);
    });

    it('adds every ledger on the legs of the vouchers the post wrote, skipping half-named ones', async () => {
      answers.voucherLedgers = [{ id: PARTY_ID }, { id: SALES_LEDGER_ID }];

      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [PARTY_ID],
        vouchers: [
          { voucherId: VOUCHER_ID, accYear: ACC_YEAR },
          { voucherId: '', accYear: ACC_YEAR },
          { voucherId: VOUCHER_ID, accYear: '' },
          null,
        ],
      });

      const [legRead] = statementsLike('SELECT DISTINCT av_ledger_id');
      const pairs = legRead.values[0] as Prisma.Sql;
      expect(pairs.values).toEqual([VOUCHER_ID, ACC_YEAR]);
      const [ledgerRead] = statementsLike('FROM accounts.acc_ledger_master');
      expect(ledgerRead.values[0]).toEqual([PARTY_ID, SALES_LEDGER_ID]);
    });

    it('skips the leg read when no voucher is fully named', async () => {
      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        vouchers: [{ voucherId: VOUCHER_ID, accYear: '' }],
      });

      expect(statementsLike('SELECT DISTINCT av_ledger_id')).toHaveLength(0);
      expect(statementsLike('FROM accounts.acc_ledger_master')).toHaveLength(0);
    });

    it("adds the ledgers behind the register rows the post moved, ignoring a row with no ledger", async () => {
      answers.chequeLedgers = [{ id: IN_HAND_ID }, { id: null }, { id: PARTY_ID }];

      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        cheques: [{ apdId: APD_ID, apdAccYear: ACC_YEAR }, { apdId: '', apdAccYear: ACC_YEAR }],
      });

      const [registerRead] = statementsLike('acc_pdc_register');
      // The same (apd_id, apd_acc_year) list binds both halves of the UNION.
      expect(registerRead.values.map((v) => (v as Prisma.Sql).values)).toEqual([
        [APD_ID, ACC_YEAR],
        [APD_ID, ACC_YEAR],
      ]);
      const [ledgerRead] = statementsLike('FROM accounts.acc_ledger_master');
      expect(ledgerRead.values[0]).toEqual([IN_HAND_ID, PARTY_ID]);
    });

    it('checks neither side of a ledger that is neither bill-by-bill nor Cheques In Hand', async () => {
      answers.ledgers = [party({ led_id: SALES_LEDGER_ID, bill_by_bill: false })];

      await assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [SALES_LEDGER_ID],
      });

      expect(statementsLike('fn_party_bill_reconcile')).toHaveLength(0);
      expect(statementsLike('fn_cheques_in_hand_reconcile')).toHaveLength(0);
    });
  });

  describe('C1 — a bill-by-bill party', () => {
    beforeEach(() => {
      answers.ledgers = [party()];
    });

    const check = () =>
      assertBooksReconcile(tx, { companyId: COMPANY_ID, accYear: ACC_YEAR, ledgerIds: [PARTY_ID] });

    it('asks the database function for the company, the party and the year', async () => {
      answers.party[PARTY_ID] = partyRow('1000', '1000');

      await check();

      const [reconcile] = statementsLike('fn_party_bill_reconcile');
      expect(reconcile.values).toEqual([COMPANY_ID, PARTY_ID, ACC_YEAR]);
    });

    it('lets half a paisa of rounding through', async () => {
      answers.party[PARTY_ID] = partyRow('1000.005', '1000');

      await expect(check()).resolves.toBeUndefined();
    });

    it('lets a party the function returns no row for through', async () => {
      await expect(check()).resolves.toBeUndefined();
    });

    it('refuses 422 ACC_PARTY_OUT_OF_BALANCE naming the party and both figures', async () => {
      answers.party[PARTY_ID] = partyRow('1500.5', '1000');

      const refusal = await refusalOf(check());

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'Party balance does not match its bills',
          errors: [
            {
              field: 'partyId',
              code: ACC_PARTY_OUT_OF_BALANCE,
              message:
                "Ravi Traders's open bills come to 1000.00 but the ledger says 1500.50 " +
                '(difference 500.50). The post has been refused so the mismatch is found now ' +
                'rather than at year end — report it with this bill.',
              partyId: PARTY_ID,
              partyName: 'Ravi Traders',
              ledger: 1500.5,
              bills: 1000,
              diff: 500.5,
            },
          ],
        },
      });
    });

    it('refuses a shortfall as readily as an excess', async () => {
      answers.party[PARTY_ID] = partyRow('999.99', '1000');

      const refusal = await refusalOf(check());

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: ACC_PARTY_OUT_OF_BALANCE, diff: -0.01 }] },
      });
    });
  });

  describe('C2 — Cheques In Hand', () => {
    beforeEach(() => {
      answers.ledgers = [inHand()];
    });

    const check = () =>
      assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [IN_HAND_ID],
      });

    it('lets a ledger that matches its register through', async () => {
      answers.inHand[IN_HAND_ID] = chequeRow('2500', '2500');

      await expect(check()).resolves.toBeUndefined();
      const [reconcile] = statementsLike('fn_cheques_in_hand_reconcile');
      expect(reconcile.values).toEqual([COMPANY_ID, IN_HAND_ID, ACC_YEAR]);
    });

    it('refuses 422 ACC_CHEQUES_OUT_OF_BALANCE naming the ledger and the register total', async () => {
      answers.inHand[IN_HAND_ID] = chequeRow('2500', '2000');

      const refusal = await refusalOf(check());

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'Cheques In Hand does not match the cheque register',
          errors: [
            {
              field: 'ledgerId',
              code: ACC_CHEQUES_OUT_OF_BALANCE,
              message:
                'Cheques In Hand stands at 2500.00 but the cheques held and deposited in the ' +
                'register come to 2000.00 (difference 500.00). The post has been refused so the ' +
                'mismatch is found now — report it with this document.',
              ledgerId: IN_HAND_ID,
              ledgerName: 'Cheques In Hand',
              ledger: 2500,
              register: 2000,
              diff: 500,
            },
          ],
        },
      });
    });
  });

  it('reports every out-of-balance ledger together, worded as a party refusal when one is a party', async () => {
    answers.ledgers = [inHand(), party()];
    answers.party[PARTY_ID] = partyRow('10', '0');
    answers.inHand[IN_HAND_ID] = chequeRow('0', '20');

    const refusal = await refusalOf(
      assertBooksReconcile(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [IN_HAND_ID, PARTY_ID],
      }),
    );

    expect(refusal).toMatchObject({
      status: 422,
      body: {
        message: 'Party balance does not match its bills',
        errors: [{ code: ACC_CHEQUES_OUT_OF_BALANCE }, { code: ACC_PARTY_OUT_OF_BALANCE }],
      },
    });
  });

  it('checks both sides of a ledger that is bill-by-bill and Cheques In Hand at once', async () => {
    answers.ledgers = [party({ in_hand: true })];
    answers.party[PARTY_ID] = partyRow('0', '0');
    answers.inHand[PARTY_ID] = chequeRow('0', '0');

    await assertBooksReconcile(tx, {
      companyId: COMPANY_ID,
      accYear: ACC_YEAR,
      ledgerIds: [PARTY_ID],
    });

    expect(statementsLike('fn_party_bill_reconcile')).toHaveLength(1);
    expect(statementsLike('fn_cheques_in_hand_reconcile')).toHaveLength(1);
  });
});
