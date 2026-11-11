import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertAmendable,
  assertBackdate,
  assertBandWritable,
  assertBillAdds,
  assertCancellable,
  assertCreditLimit,
  assertDayOpen,
  assertRight,
  assertSalesmen,
  assertTenderTotal,
  loadDayClosed,
  heldOrdersDrawnMore,
  loadHeldOrders,
  lockSourceOrders,
  ordersDrawnMore,
  refuse,
  refuseHeldOrders,
  warn,
  type SalesWriteClient,
} from './sales.guards';
import { SALES_SETTING_DEFAULTS, type SalesSettings } from './sales.settings';
import { createGuardContext, SALES_ERROR_CODES } from './types/posting.types';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46ab01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46ab02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46ab03';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46ab04';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46ab05';
const EMP_A = '019c6f6c-be87-7a11-8905-36092c46ab06';
const EMP_B = '019c6f6c-be87-7a11-8905-36092c46ab07';
const GDR_ID = '019c6f6c-be87-7a11-8905-36092c46ab08';

type Answer = unknown[] | ((values: unknown[]) => unknown[]);

/**
 * A `$queryRaw` that answers by the SQL it is handed: the first route whose
 * needle the statement contains wins. An unrouted statement fails the test.
 */
function routedQuery(routes: [needle: string, answer: Answer][]): jest.Mock {
  return jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    const hit = routes.find(([needle]) => sql.includes(needle));
    if (!hit) {
      throw new Error(`unrouted SQL: ${sql.slice(0, 120)}`);
    }
    return typeof hit[1] === 'function' ? hit[1](values) : hit[1];
  });
}

const clientOf = (queryRaw: jest.Mock, queryRawUnsafe = jest.fn()) =>
  ({ $queryRaw: queryRaw, $queryRawUnsafe: queryRawUnsafe }) as unknown as SalesWriteClient;

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

const settings = (overrides: Partial<SalesSettings> = {}): SalesSettings => ({
  ...SALES_SETTING_DEFAULTS,
  ...overrides,
});

/** A context that collects instead of throwing, as `/validate` runs it. */
const collecting = () => createGuardContext({ throwOnRefusal: false });

describe('sales.guards', () => {
  describe('warn — the override machinery', () => {
    it('lets an overridable WARN through as INFO when it is asked for and allowed', () => {
      const ctx = createGuardContext({ overrides: ['SALES_X'], canOverride: true });

      warn(ctx, 'SALES_X', 'Heads up');

      expect(ctx.warnings).toEqual([
        {
          code: 'SALES_X',
          level: 'INFO',
          message: 'Heads up',
          field: undefined,
          line: undefined,
          overridable: true,
          statutory: undefined,
        },
      ]);
      expect(ctx.refusals).toEqual([]);
    });

    it('refuses an override the user has no right to, even when the request asks for it', async () => {
      const ctx = createGuardContext({ overrides: ['SALES_X'], canOverride: false });

      const refusal = await refusalOf(Promise.resolve().then(() => warn(ctx, 'SALES_X', 'No')));

      expect(refusal).toMatchObject({ status: 422, body: { errors: [{ code: 'SALES_X' }] } });
      expect(ctx.warnings[0].level).toBe('WARN');
    });

    it('reports an overridable WARN on a dry run without also refusing it', () => {
      const ctx = createGuardContext({ dryRun: true });

      warn(ctx, 'SALES_X', 'Heads up', { field: 'billDate' });

      expect(ctx.warnings).toHaveLength(1);
      expect(ctx.refusals).toEqual([]);
    });

    it('records a non-overridable WARN as a refusal even on a dry run', () => {
      const ctx = createGuardContext({ dryRun: true, throwOnRefusal: false });

      warn(ctx, 'SALES_X', 'Hard stop', { overridable: false, line: 3 });

      expect(ctx.warnings[0]).toMatchObject({ level: 'WARN', overridable: false });
      expect(ctx.refusals).toEqual([
        { code: 'SALES_X', message: 'Hard stop', field: undefined, line: 3, statutory: undefined },
      ]);
    });
  });

  describe('refuse', () => {
    it('collects without throwing when throwOnRefusal is off', () => {
      const ctx = collecting();

      refuse(ctx, 'SALES_A', 'one');
      refuse(ctx, 'SALES_B', 'two', { field: 'tenders' });

      expect(ctx.refusals.map((r) => r.code)).toEqual(['SALES_A', 'SALES_B']);
    });

    it('throws a 422 on document when no field is named, carrying the line', async () => {
      const refusal = await refusalOf(
        Promise.resolve().then(() => refuse(createGuardContext(), 'SALES_A', 'Stop', { line: 7 })),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'document', code: 'SALES_A', line: 7 }] },
      });
    });
  });

  describe('assertRight', () => {
    const rightsRow = (overrides: Record<string, boolean>) => ({
      um_can_view: true,
      um_can_create: true,
      um_can_edit: true,
      um_can_delete: false,
      um_can_print: true,
      um_can_export: false,
      um_can_post: false,
      um_can_cancel: false,
      um_can_amend: false,
      um_can_override: false,
      um_can_retender: false,
      ...overrides,
    });

    it('answers every flag when the user holds the one asked for', async () => {
      const client = clientOf(
        routedQuery([['public.user_menus', [rightsRow({ um_can_post: true })]]]),
      );

      await expect(assertRight(client, USER_ID, 12, 'post')).resolves.toMatchObject({
        post: true,
        cancel: false,
      });
    });

    it('refuses with a 403 naming the user_menus column', async () => {
      const client = clientOf(routedQuery([['public.user_menus', [rightsRow({})]]]));

      const refusal = await refusalOf(assertRight(client, USER_ID, 12, 'post'));

      expect(refusal).toMatchObject({
        status: 403,
        body: {
          errors: [
            {
              field: 'userId',
              code: SALES_ERROR_CODES.RIGHT_POST,
              message: 'This user may not post on this menu (um_can_post is false)',
            },
          ],
        },
      });
    });

    it('treats a user with no user_menus row as holding nothing', async () => {
      const client = clientOf(routedQuery([['public.user_menus', []]]));

      const refusal = await refusalOf(assertRight(client, USER_ID, 12, 'view'));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_VIEW }] },
      });
    });
  });

  describe('assertBackdate', () => {
    const TODAY = '2026-10-19';

    it('refuses a future date whatever the setting says', () => {
      const ctx = collecting();

      assertBackdate(ctx, '2026-10-20', settings({ backdateMode: 'ALLOW' }), TODAY);

      expect(ctx.refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, field: 'billDate' }),
      ]);
    });

    it('lets today through, and the past through under ALLOW', () => {
      const ctx = collecting();

      assertBackdate(ctx, TODAY, settings({ backdateMode: 'REFUSE' }), TODAY);
      assertBackdate(ctx, '2026-10-01', settings({ backdateMode: 'ALLOW' }), TODAY);

      expect(ctx.refusals).toEqual([]);
      expect(ctx.warnings).toEqual([]);
    });

    it('refuses the past under REFUSE without a warning', () => {
      const ctx = collecting();

      assertBackdate(ctx, '2026-10-01', settings({ backdateMode: 'REFUSE' }), TODAY, 'sdcDcDate');

      expect(ctx.warnings).toEqual([]);
      expect(ctx.refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, field: 'sdcDcDate' }),
      ]);
    });

    it('warns about the past under WARN, and an allowed override passes it', () => {
      const ctx = createGuardContext({
        overrides: [SALES_ERROR_CODES.BACKDATE],
        canOverride: true,
      });

      assertBackdate(ctx, '2026-10-01', settings({ backdateMode: 'WARN' }), TODAY);

      expect(ctx.warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, level: 'INFO' }),
      ]);
      expect(ctx.refusals).toEqual([]);
    });
  });

  describe('loadDayClosed / assertDayOpen', () => {
    it('is closed when the till has Z-ed the business day, without looking further', async () => {
      const queryRawUnsafe = jest.fn();
      const client = clientOf(
        routedQuery([['accounts.till_business_day', [{ n: 1 }]]]),
        queryRawUnsafe,
      );

      await expect(loadDayClosed(client, COMPANY_ID, BRANCH_ID, '2026-10-19')).resolves.toBe(true);
      expect(queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('is open while there is no day-close table at all', async () => {
      const queryRawUnsafe = jest.fn();
      const client = clientOf(
        routedQuery([
          ['accounts.till_business_day', [{ n: 0 }]],
          ['to_regclass', [{ tbl: null }]],
        ]),
        queryRawUnsafe,
      );

      await expect(loadDayClosed(client, COMPANY_ID, BRANCH_ID, '2026-10-19')).resolves.toBe(false);
      expect(queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('reads acc_day_close with bound parameters once the table exists', async () => {
      const queryRawUnsafe = jest.fn().mockResolvedValue([{ n: 2n }]);
      const client = clientOf(
        routedQuery([
          ['accounts.till_business_day', [{ n: 0 }]],
          ['to_regclass', [{ tbl: 'accounts.acc_day_close' }]],
        ]),
        queryRawUnsafe,
      );

      await expect(loadDayClosed(client, COMPANY_ID, BRANCH_ID, '2026-10-19')).resolves.toBe(true);
      expect(queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('FROM accounts.acc_day_close'),
        COMPANY_ID,
        BRANCH_ID,
        '2026-10-19',
      );
    });

    it('assertDayOpen refuses a closed day with a 409', async () => {
      const client = clientOf(routedQuery([['accounts.till_business_day', [{ n: 1 }]]]));

      const refusal = await refusalOf(
        assertDayOpen(client, COMPANY_ID, BRANCH_ID, '2026-10-19', 'sbBillDate'),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sbBillDate', code: SALES_ERROR_CODES.DAY_CLOSED }] },
      });
    });
  });

  describe('assertCreditLimit', () => {
    const party = { custId: CUST_ID, partyLedgerId: LEDGER_ID };
    const limitsClient = (
      limits: Record<string, unknown> | null,
      open: Record<string, unknown> = { pending: null, bills: 0n, oldest: null },
    ) =>
      clientOf(
        routedQuery([
          ['FROM sales.customers', limits ? [limits] : []],
          ['accounts.acc_bill_balance', [open]],
        ]),
      );

    it('counts part-paid bills: money left on a live DR bill, not abl_status OPEN (Q7)', async () => {
      const query = routedQuery([
        ['FROM sales.customers', [{ cus_credit_amt_limit: new Prisma.Decimal(10000) }]],
        [
          'accounts.acc_bill_balance',
          [{ pending: new Prisma.Decimal(9000), bills: 1n, oldest: null }],
        ],
      ]);
      const ctx = createGuardContext({ dryRun: true });

      await assertCreditLimit(clientOf(query), ctx, party, COMPANY_ID, 1500, settings());

      const sql = (query.mock.calls[1][0] as string[]).join('?');
      expect(sql).toContain('abl_pending_amount > 0');
      expect(sql).toContain('abl_is_active  = true');
      expect(sql).not.toContain('abl_status');
      expect(ctx.warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.CREDIT_LIMIT }),
      ]);
    });

    it('reads nothing when the mode is OFF', async () => {
      const query = routedQuery([]);
      const ctx = collecting();

      await assertCreditLimit(
        clientOf(query),
        ctx,
        party,
        COMPANY_ID,
        5000,
        settings({ creditLimitMode: 'OFF' }),
      );

      expect(query).not.toHaveBeenCalled();
    });

    it('passes a customer with no row', async () => {
      const ctx = collecting();

      await assertCreditLimit(limitsClient(null), ctx, party, COMPANY_ID, 5000, settings());

      expect(ctx.refusals).toEqual([]);
    });

    it('warns when outstanding plus this bill crosses the amount limit', async () => {
      const ctx = createGuardContext({ dryRun: true });

      await assertCreditLimit(
        limitsClient(
          { cus_credit_amt_limit: new Prisma.Decimal(10000), cus_credit_bill_limit: 0 },
          { pending: new Prisma.Decimal(8000), bills: 2n, oldest: null },
        ),
        ctx,
        party,
        COMPANY_ID,
        2500,
        settings({ creditLimitMode: 'WARN' }),
      );

      expect(ctx.warnings).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.CREDIT_LIMIT,
          field: 'custId',
          message: 'Outstanding 8000 plus this bill 2500 exceeds the credit limit 10000',
        }),
      ]);
    });

    it('lets a bill land exactly on the amount limit', async () => {
      const ctx = collecting();

      await assertCreditLimit(
        limitsClient(
          { cus_credit_amt_limit: new Prisma.Decimal(10000) },
          { pending: new Prisma.Decimal(8000), bills: 1n, oldest: null },
        ),
        ctx,
        party,
        COMPANY_ID,
        2000,
        settings({ creditLimitMode: 'REFUSE' }),
      );

      expect(ctx.refusals).toEqual([]);
    });

    it('refuses on the open-bill count under REFUSE, without a warning', async () => {
      const ctx = collecting();

      await assertCreditLimit(
        limitsClient({ cus_credit_bill_limit: 3 }, { pending: null, bills: 3n, oldest: null }),
        ctx,
        party,
        COMPANY_ID,
        100,
        settings({ creditLimitMode: 'REFUSE' }),
      );

      expect(ctx.warnings).toEqual([]);
      expect(ctx.refusals).toEqual([
        expect.objectContaining({
          message: 'This customer already has 3 open bills; the limit is 3',
        }),
      ]);
    });

    it('refuses when the oldest open bill is older than the credit days, as of the document date', async () => {
      const ctx = collecting();

      await assertCreditLimit(
        limitsClient(
          { cus_credit_days: 30 },
          { pending: null, bills: 1n, oldest: new Date('2026-09-01T00:00:00.000Z') },
        ),
        ctx,
        party,
        COMPANY_ID,
        100,
        settings({ creditLimitMode: 'REFUSE' }),
        '2026-10-19',
      );

      expect(ctx.refusals).toEqual([
        expect.objectContaining({
          message: "This customer's oldest open bill is 48 days old; the limit is 30",
        }),
      ]);
    });

    it('treats a zero limit as no limit', async () => {
      const ctx = collecting();

      await assertCreditLimit(
        limitsClient(
          {
            cus_credit_amt_limit: new Prisma.Decimal(0),
            cus_credit_bill_limit: 0,
            cus_credit_days: 0,
          },
          {
            pending: new Prisma.Decimal(999999),
            bills: 99n,
            oldest: new Date('2020-01-01T00:00:00.000Z'),
          },
        ),
        ctx,
        party,
        COMPANY_ID,
        100,
        settings({ creditLimitMode: 'REFUSE' }),
        '2026-10-19',
      );

      expect(ctx.refusals).toEqual([]);
    });
  });

  describe('loadHeldOrders / refuseHeldOrders — the delivery hold (D18)', () => {
    it('reads nothing when the document names no order', async () => {
      const query = routedQuery([]);

      expect(await loadHeldOrders(clientOf(query), [], [])).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('asks by order id and by order-line id under the row lock, and lists every held order', async () => {
      const query = routedQuery([
        [
          'FOR UPDATE OF h',
          [
            {
              so_id: 'o1',
              so_order_refno: 'SO/1',
              so_status: 'CONFIRMED',
              so_delivery_hold: true,
              so_delivery_hold_reason: 'After 15th',
            },
            {
              so_id: 'o2',
              so_order_refno: null,
              so_status: 'CONFIRMED',
              so_delivery_hold: true,
              so_delivery_hold_reason: null,
            },
            {
              so_id: 'o3',
              so_order_refno: 'SO/3',
              so_status: 'CONFIRMED',
              so_delivery_hold: false,
              so_delivery_hold_reason: null,
            },
          ],
        ],
      ]);
      const ctx = createGuardContext({ throwOnRefusal: false });

      const held = await loadHeldOrders(clientOf(query), ['o1'], ['l9']);
      refuseHeldOrders(ctx, held);

      expect(query.mock.calls[0].slice(1)).toEqual([['o1'], ['l9']]);
      expect(ctx.refusals).toEqual([
        {
          code: SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
          field: 'items',
          message:
            'Order SO/1 is on delivery hold: After 15th. Release it on Sales Order Management first.',
          line: undefined,
          statutory: undefined,
        },
        {
          code: SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
          field: 'items',
          message: 'Order o2 is on delivery hold. Release it on Sales Order Management first.',
          line: undefined,
          statutory: undefined,
        },
      ]);
    });
  });

  describe('lockSourceOrders / the hold on an amend (review 2026-11-11)', () => {
    const D = (v: number) => new Prisma.Decimal(v);

    it('locks nothing when the document names no order', async () => {
      const query = routedQuery([]);

      expect(await lockSourceOrders(clientOf(query), [], [])).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('locks the orders FOR UPDATE in so_id order and reads status and hold under the lock', async () => {
      const query = routedQuery([
        [
          'FOR UPDATE OF h',
          [
            {
              so_id: 'o1',
              so_order_refno: 'SO/1',
              so_status: 'CONFIRMED',
              so_delivery_hold: false,
              so_delivery_hold_reason: null,
            },
          ],
        ],
      ]);

      const rows = await lockSourceOrders(clientOf(query), ['o1'], ['l1']);

      const sql = (query.mock.calls[0][0] as TemplateStringsArray).join('?');
      expect(sql).toContain('ORDER BY h.so_id');
      expect(sql).not.toContain('FOR SHARE');
      expect(rows).toEqual([
        { soId: 'o1', refno: 'SO/1', status: 'CONFIRMED', hold: false, holdReason: null },
      ]);
    });

    it('ordersDrawnMore: compares line by line in base units, a line with no order line by its order', () => {
      const ids = new Set(['o1']);
      const owner = new Map([
        ['l1', 'o1'],
        ['l2', 'o1'],
      ]);
      const draw = (soiId: string | null, qty: number, soId: string | null = 'o1') => ({
        soId,
        soiId,
        baseQty: D(qty),
      });

      expect(ordersDrawnMore(ids, owner, [draw('l1', 4)], [draw('l1', 4)])).toEqual(new Set());
      expect(ordersDrawnMore(ids, owner, [draw('l1', 3)], [draw('l1', 4)])).toEqual(new Set());
      expect(ordersDrawnMore(ids, owner, [], [draw('l1', 4)])).toEqual(new Set());
      expect(ordersDrawnMore(ids, owner, [draw('l1', 5)], [draw('l1', 4)])).toEqual(
        new Set(['o1']),
      );
      // A move from one line to another is drawing more from the second.
      expect(ordersDrawnMore(ids, owner, [draw('l1', 2), draw('l2', 2)], [draw('l1', 4)])).toEqual(
        new Set(['o1']),
      );
      // A line naming only the order counts against the order as a whole.
      expect(ordersDrawnMore(ids, owner, [draw(null, 1)], [])).toEqual(new Set(['o1']));
      // Another order's lines are not this check's business.
      expect(ordersDrawnMore(ids, owner, [draw(null, 9, 'o2')], [])).toEqual(new Set());
    });

    it('heldOrdersDrawnMore maps order lines to their orders, and reads nothing with no held order', async () => {
      const query = routedQuery([
        ['SELECT soi_id, soi_order_id', [{ soi_id: 'l1', soi_order_id: 'o1' }]],
      ]);
      const held = [{ soId: 'o1', refno: 'SO/1', reason: null }];

      expect(
        await heldOrdersDrawnMore(
          clientOf(query),
          held,
          [{ soId: null, soiId: 'l1', baseQty: D(5) }],
          [{ soId: null, soiId: 'l1', baseQty: D(4) }],
        ),
      ).toEqual(held);

      const none = routedQuery([]);
      expect(await heldOrdersDrawnMore(clientOf(none), [], [], [])).toEqual([]);
      expect(none).not.toHaveBeenCalled();
    });
  });

  describe('assertSalesmen — the guard that replaces a foreign key', () => {
    it('accepts null as "nobody" without a read', async () => {
      const query = routedQuery([]);

      await assertSalesmen(clientOf(query), COMPANY_ID, null);

      expect(query).not.toHaveBeenCalled();
    });

    it('refuses an empty array, which names nobody while reading as a team', async () => {
      const refusal = await refusalOf(assertSalesmen(clientOf(routedQuery([])), COMPANY_ID, []));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'salesmanId', code: SALES_ERROR_CODES.SALESMAN_INVALID }] },
      });
    });

    it('refuses one person named twice before reading anything', async () => {
      const query = routedQuery([]);

      const refusal = await refusalOf(
        assertSalesmen(clientOf(query), COMPANY_ID, [EMP_A, EMP_A], { field: 'loadmanId' }),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'loadmanId', code: SALES_ERROR_CODES.SALESMAN_INVALID }] },
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('refuses ids that are not live employees of this company, naming them', async () => {
      const query = routedQuery([['public.employee_master', [{ emp_id: EMP_A }]]]);

      const refusal = await refusalOf(assertSalesmen(clientOf(query), COMPANY_ID, [EMP_A, EMP_B]));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              message: `salesmanId names an employee that do not exist, are deleted, or belong to another company: ${EMP_B}`,
            },
          ],
        },
      });
      const values = query.mock.calls[0].slice(1) as unknown[];
      expect(values).toEqual([[EMP_A, EMP_B], COMPANY_ID]);
    });

    it('passes when every id is a live employee of the company', async () => {
      const query = routedQuery([
        ['public.employee_master', [{ emp_id: EMP_A }, { emp_id: EMP_B }]],
      ]);

      await expect(
        assertSalesmen(clientOf(query), COMPANY_ID, [EMP_A, EMP_B]),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertTenderTotal / assertBillAdds', () => {
    it('passes tenders up to the bill and over it when excess is allowed', () => {
      const ctx = collecting();

      assertTenderTotal(ctx, 1000, 1000, settings());
      assertTenderTotal(ctx, 1200, 1000, settings({ allowExcessTender: true }));

      expect(ctx.warnings).toEqual([]);
    });

    it('warns about tenders over the bill', () => {
      const ctx = createGuardContext({ dryRun: true });

      assertTenderTotal(ctx, 1000.01, 1000, settings());

      expect(ctx.warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.TENDER_MIN_MAX, field: 'tenders' }),
      ]);
    });

    it('lets a bill off by a paisa through and refuses one off by more', () => {
      const ctx = collecting();

      assertBillAdds(ctx, 1000.01, 1000);
      expect(ctx.refusals).toEqual([]);

      assertBillAdds(ctx, 1000.02, 1000, 'sdcAmount');
      expect(ctx.refusals).toEqual([
        expect.objectContaining({
          field: 'sdcAmount',
          message:
            'The bill does not add up: the lines and charges make 1000.02, the bill says 1000',
        }),
      ]);
    });
  });

  describe('the declared locks', () => {
    const locksClient = (irn: boolean, ewb: boolean) =>
      clientOf(routedQuery([['acc_voucher_doc_einvoice', [{ irn_live: irn, ewb_live: ewb }]]]));

    it('reads nothing for a document with no register row', async () => {
      const query = routedQuery([]);

      await assertAmendable(clientOf(query), null);
      await assertBandWritable(clientOf(query), null);

      expect(query).not.toHaveBeenCalled();
    });

    it('refuses an amend under a live IRN, before looking at the e-way bill', async () => {
      const refusal = await refusalOf(assertAmendable(locksClient(true, true), GDR_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sbId', code: SALES_ERROR_CODES.IRN_LIVE }] },
      });
    });

    it('refuses an amend under a live e-way bill', async () => {
      const refusal = await refusalOf(assertAmendable(locksClient(false, true), GDR_ID));

      expect(refusal).toMatchObject({ body: { errors: [{ code: SALES_ERROR_CODES.EWB_LIVE }] } });
    });

    it('lets an undeclared document be amended and its band edited', async () => {
      await expect(assertAmendable(locksClient(false, false), GDR_ID)).resolves.toBeUndefined();
      await expect(assertBandWritable(locksClient(false, false), GDR_ID)).resolves.toBeUndefined();
    });

    it('freezes the transport band once either is declared', async () => {
      for (const [irn, ewb] of [
        [true, false],
        [false, true],
      ]) {
        const refusal = await refusalOf(assertBandWritable(locksClient(irn, ewb), GDR_ID));

        expect(refusal).toMatchObject({
          status: 409,
          body: { errors: [{ field: 'transport', code: SALES_ERROR_CODES.DECLARED_LOCKED }] },
        });
      }
    });
  });

  describe('assertCancellable', () => {
    const bill = { billId: CUST_ID, accYear: '2026-2027', companyId: COMPANY_ID };
    const clientWith = (returns: bigint, allocations: bigint) =>
      clientOf(routedQuery([['sales.sale_return', [{ returns, allocations }]]]));

    it('refuses while a live sale return names the bill', async () => {
      const refusal = await refusalOf(assertCancellable(clientWith(1n, 1n), bill));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.RETURN_LOCKS_BILL }] },
      });
    });

    it('refuses while a receipt is allocated against the bill', async () => {
      const refusal = await refusalOf(assertCancellable(clientWith(0n, 2n), bill));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.ALLOCATION_LOCKS_BILL }] },
      });
    });

    it('passes a bill with neither', async () => {
      await expect(assertCancellable(clientWith(0n, 0n), bill)).resolves.toBeUndefined();
    });
  });
});
