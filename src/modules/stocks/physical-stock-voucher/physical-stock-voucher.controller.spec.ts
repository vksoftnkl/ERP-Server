import { PhysicalStockVoucherController } from './physical-stock-voucher.controller';
import type { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { PrismaService } from 'src/database/prisma/prisma.service';
import type { RequestContextService } from 'src/common/request-context/request-context.service';
import type {
  StockVoucherCancelResult,
  StockVoucherLinePayload,
  StockVoucherPostResult,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const ACC_YEAR = '2026-2027';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe99';

/** tester's `user_menus` row for menu 45 — every flag granted unless a test revokes one. */
const allRights = () => ({
  um_can_view: true,
  um_can_create: true,
  um_can_edit: true,
  um_can_delete: true,
  um_can_print: true,
  um_can_export: true,
  um_can_post: true,
  um_can_cancel: true,
  um_can_amend: true,
  um_can_override: true,
  um_can_retender: true,
});

const line = (lineNo: number, diffQty: number | null): StockVoucherLinePayload =>
  ({ lineNo, diffQty }) as StockVoucherLinePayload;

const postResult = (lines: StockVoucherLinePayload[], rowsPosted: number): StockVoucherPostResult =>
  ({
    header: { svhId: SVH_ID, status: 'POSTED', postedOn: '2026-06-30T18:00:00Z' },
    lines,
    rowsPosted,
    status: 'POSTED',
    postedOn: '2026-06-30T18:00:00Z',
  }) as unknown as StockVoucherPostResult;

const cancelResult = (rowsReversed: number): StockVoucherCancelResult =>
  ({
    header: { svhId: SVH_ID, status: 'CANCELLED' },
    lines: [],
    rowsReversed,
    status: 'CANCELLED',
    cancelledOn: '2026-06-30T18:00:00Z',
  }) as unknown as StockVoucherCancelResult;

describe('PhysicalStockVoucherController', () => {
  let service: {
    post: jest.Mock;
    cancel: jest.Mock;
    countSheet: jest.Mock;
    variance: jest.Mock;
    save: jest.Mock;
    getById: jest.Mock;
    list: jest.Mock;
    validate: jest.Mock;
  };
  let controller: PhysicalStockVoucherController;
  let rightsRow: Record<string, boolean> | null;
  let rightsRead: jest.Mock;
  /** Delivery tracking reads (BND per holding, sell units, the stored snapshot): by SQL marker. */
  let deliveryRows: { bnd: unknown[]; units: unknown[]; stored: unknown[] };

  beforeEach(() => {
    rightsRow = allRights();
    deliveryRows = { bnd: [], units: [], stored: [] };
    rightsRead = jest.fn(async (strings: TemplateStringsArray | { strings?: string[] }) => {
      const text = Array.isArray(strings)
        ? strings.join('?')
        : ((strings as { strings?: string[] }).strings ?? []).join('?');
      if (text.includes('FROM public.user_menus')) return rightsRow ? [rightsRow] : [];
      if (text.includes('op.pending_qty, op.pending_base, um.unit_name')) return deliveryRows.bnd;
      if (text.includes('COALESCE(dfl.factor, 1) AS factor')) return deliveryRows.units;
      if (text.includes('svi.svi_undelivered_qty, itm.item_name_en')) return deliveryRows.stored;
      return [];
    });
    service = {
      post: jest.fn(),
      cancel: jest.fn(),
      countSheet: jest.fn(),
      variance: jest.fn(),
      save: jest.fn(),
      getById: jest.fn(),
      list: jest.fn(),
      validate: jest.fn(),
    };
    controller = new PhysicalStockVoucherController(
      service as unknown as StockVoucherService,
      { $queryRaw: rightsRead } as unknown as PrismaService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  // ── notes 150 #6 — every route is judged on the caller's menu-45 row ──────
  describe('menu 45 rights', () => {
    it("reads the caller's user_menus row for menu 45 before a post", async () => {
      service.post.mockResolvedValue(postResult([line(1, 0)], 0));

      await controller.post({ ...REF, userId: USER_ID } as never);

      const [strings, ...values] = rightsRead.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join('?')).toContain('FROM public.user_menus');
      expect(values).toEqual([USER_ID, 45]);
    });

    it('refuses a caller whose row lacks the right, naming the column (403 PHY_RIGHT_POST)', async () => {
      rightsRow = { ...allRights(), um_can_post: false };

      await expect(controller.post({ ...REF, userId: USER_ID } as never)).rejects.toMatchObject({
        status: 403,
        response: {
          errors: [expect.objectContaining({ code: 'PHY_RIGHT_POST', field: 'userId' })],
        },
      });
      expect(service.post).not.toHaveBeenCalled();
    });

    it('a caller with no row at all has no rights — even to read', async () => {
      rightsRow = null;

      await expect(controller.countSheet({} as never)).rejects.toMatchObject({ status: 403 });
      expect(service.countSheet).not.toHaveBeenCalled();
    });

    it('a save that also posts needs the post right as well as create', async () => {
      rightsRow = { ...allRights(), um_can_post: false };

      await expect(
        controller.save({ header: { post: true }, lines: [] } as never),
      ).rejects.toMatchObject({
        response: { errors: [expect.objectContaining({ code: 'PHY_RIGHT_POST' })] },
      });
      expect(service.save).not.toHaveBeenCalled();
    });
  });

  const REF = { svhId: SVH_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

  // ── count sheet ───────────────────────────────────────────────────────────
  it('says how many holdings the sheet asks to be counted', async () => {
    const sheet = { items: [{ lotId: 'a' }, { lotId: 'b' }], meta: { limit: 200, offset: 0 } };
    service.countSheet.mockResolvedValue(sheet);
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: SVH_ID };

    await expect(controller.countSheet(query as never)).resolves.toEqual({
      success: true,
      message: '2 holdings to count',
      data: {
        ...sheet,
        // Delivery tracking (addendum §5.3): nothing billed-not-delivered here.
        items: sheet.items.map((i) => ({
          ...i,
          undeliveredQty: 0,
          physicalQty: 0,
          undeliveredBills: [],
          sellUnitName: undefined,
          sellUnitFactor: 1,
        })),
      },
    });
    const [rules, sent] = service.countSheet.mock.calls[0] as [StockVoucherTypeRules, unknown];
    expect(rules.voucherType).toBe('PHYSICAL');
    expect(sent).toBe(query);
  });

  // ── delivery tracking (addendum §5.3) ───────────────────────────────────
  describe('Billed not delivered on the count (delivery tracking)', () => {
    const ITEM = '01a161d8-4fd1-78ed-841a-a6e28b641ec2';
    const LOT = 'dd08de2b-18f1-575d-b653-df1765055465';
    const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';

    it('count-sheet: undeliveredQty, physicalQty = book + it, the bills oldest first, the selling unit', async () => {
      service.countSheet.mockResolvedValue({
        items: [{ itemId: ITEM, lotId: LOT, godownId: GODOWN, bucket: 'SALEABLE', bookQty: 1500, unitName: 'Kg' }],
        meta: { limit: 200, offset: 0, count: 1 },
      });
      deliveryRows.bnd = [
        { bill_id: 'b1', bill_acc_year: '2026-2027', bill_refno: 'WS/0016', cust_name: 'ZT-A', godown_id: GODOWN, item_id: ITEM, lot_id: LOT, bucket: 'SALEABLE', pending_qty: '16', pending_base: '400', unit_name: 'Bag' },
        { bill_id: 'b2', bill_acc_year: '2026-2027', bill_refno: 'WS/0017', cust_name: 'ZT-B', godown_id: GODOWN, item_id: ITEM, lot_id: LOT, bucket: 'SALEABLE', pending_qty: '24', pending_base: '600', unit_name: 'Bag' },
      ];
      deliveryRows.units = [{ item_id: ITEM, unit_name: 'Bag', factor: '25' }];

      const res = await controller.countSheet({ companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN } as never);

      expect(res.data.items[0]).toMatchObject({
        undeliveredQty: 1000,
        physicalQty: 2500,
        sellUnitName: 'Bag',
        sellUnitFactor: 25,
        undeliveredBills: [
          { billId: 'b1', billRefno: 'WS/0016', custName: 'ZT-A', qty: 16, unitName: 'Bag', baseQty: 400 },
          { billId: 'b2', billRefno: 'WS/0017', custName: 'ZT-B', qty: 24, unitName: 'Bag', baseQty: 600 },
        ],
      });
    });

    it('validate: WARN PHY_UNDELIVERED_CHANGED when the snapshot differs from now (advisory, problem untouched)', async () => {
      service.validate.mockResolvedValue([
        { sviId: 's1', lineNo: 1, splitNo: 1, itemId: ITEM, itemCode: 'R', itemName: 'Rice', problem: null },
        { sviId: 's2', lineNo: 2, splitNo: 1, itemId: ITEM, itemCode: 'R', itemName: 'Rice', problem: null },
      ]);
      deliveryRows.stored = [
        { svi_id: 's1', svi_line_no: 1, svi_godown_id: GODOWN, svi_item_id: ITEM, svi_lot_id: LOT, svi_bucket: 'SALEABLE', svi_undelivered_qty: '1000', item_name: 'Rice' },
        { svi_id: 's2', svi_line_no: 2, svi_godown_id: GODOWN, svi_item_id: ITEM, svi_lot_id: 'other', svi_bucket: 'SALEABLE', svi_undelivered_qty: '0', item_name: 'Rice' },
      ];
      deliveryRows.bnd = [
        { bill_id: 'b1', bill_acc_year: '2026-2027', bill_refno: 'WS/0016', cust_name: 'ZT-A', godown_id: GODOWN, item_id: ITEM, lot_id: LOT, bucket: 'SALEABLE', pending_qty: '16', pending_base: '400', unit_name: 'Bag' },
      ];

      const res = await controller.validate(REF as never);

      expect(res.data[0]).toMatchObject({
        problem: null,
        undeliveredQty: 400,
        previousUndeliveredQty: 1000,
        undeliveredChanged: true,
        warning: { code: 'PHY_UNDELIVERED_CHANGED', level: 'WARN', params: { n: 1, item: 'Rice', old: 1000, new: 400 } },
      });
      expect(res.data[1]).toMatchObject({ undeliveredChanged: false, warning: null, undeliveredQty: 0 });
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('save', () => {
    it.each([
      ['a new draft', undefined, null, 'Physical stock count created successfully'],
      ['an edited draft', SVH_ID, null, 'Physical stock count updated successfully'],
      [
        'a new count saved and posted',
        undefined,
        2,
        'Physical stock count created and posted — 2 line(s) varied',
      ],
      [
        'an edited count saved and posted',
        SVH_ID,
        0,
        'Physical stock count updated and posted — 0 line(s) varied',
      ],
    ])('words %s', async (_label, svhId, rowsPosted, message) => {
      const result = { header: { svhId: SVH_ID }, lines: [], rowsPosted };
      service.save.mockResolvedValue(result);
      const dto = { header: { svhId }, lines: [] };

      await expect(controller.save(dto as never)).resolves.toEqual({
        success: true,
        message,
        data: result,
      });
      // The narrower count line goes through as it is: the service reads the
      // unit, factor and base quantity off the holding on the COUNT branch.
      const [rules, sent] = service.save.mock.calls[0] as [StockVoucherTypeRules, unknown];
      expect(rules.voucherType).toBe('PHYSICAL');
      expect(sent).toBe(dto);
    });
  });

  // ── get ───────────────────────────────────────────────────────────────────
  describe('listOrLoad', () => {
    it('loads one count when svhId is sent', async () => {
      const doc = { header: { svhId: SVH_ID }, lines: [] };
      service.getById.mockResolvedValue(doc);

      await expect(controller.listOrLoad(REF as never)).resolves.toEqual({
        success: true,
        message: 'Physical stock count fetched successfully',
        data: doc,
      });
      expect(service.getById).toHaveBeenCalledWith(
        expect.objectContaining({ voucherType: 'PHYSICAL' }),
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
      );
      expect(service.list).not.toHaveBeenCalled();
    });

    it('lists the counts otherwise, passing the whole query on', async () => {
      const list = { items: [], meta: { page: 1, limit: 20, total: 0 } };
      service.list.mockResolvedValue(list);
      const query = { accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

      await expect(controller.listOrLoad(query as never)).resolves.toEqual({
        success: true,
        message: 'Physical stock count list fetched successfully',
        data: list,
      });
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ voucherType: 'PHYSICAL' }),
        query,
      );
      expect(service.getById).not.toHaveBeenCalled();
    });
  });

  // ── validate ──────────────────────────────────────────────────────────────
  describe('validate', () => {
    it('counts the lines with problems, agreeing lines included in the total', async () => {
      service.validate.mockResolvedValue([
        { lineNo: 1, problem: null },
        { lineNo: 2, problem: 'the book quantity has changed since this sheet was generated' },
      ]);

      await expect(controller.validate(REF)).resolves.toMatchObject({
        success: true,
        message: '1 of 2 lines have problems',
      });
      expect(service.validate).toHaveBeenCalledWith(
        expect.objectContaining({ voucherType: 'PHYSICAL' }),
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
      );
    });

    it('says every line is clean when none has a problem', async () => {
      service.validate.mockResolvedValue([{ lineNo: 1, problem: null }]);

      await expect(controller.validate(REF)).resolves.toMatchObject({
        message: 'All 1 lines are clean',
      });
    });
  });

  it('counts the variance rows when some lines varied, and passes the paging on', async () => {
    const report = { items: [{ lineNo: 2 }, { lineNo: 3 }], meta: { limit: 50, offset: 0 } };
    service.variance.mockResolvedValue(report);

    await expect(controller.variance({ ...REF, limit: 50, offset: 0 })).resolves.toEqual({
      success: true,
      message: '2 variance rows',
      data: report,
    });
    expect(service.variance).toHaveBeenCalledWith(
      expect.objectContaining({ voucherType: 'PHYSICAL' }),
      SVH_ID,
      ACC_YEAR,
      COMPANY_ID,
      BRANCH_ID,
      50,
      0,
    );
  });

  const post = () =>
    controller.post({
      svhId: SVH_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });

  /**
   * §3.6 — the whole point of the wording. A count where every line agrees
   * returns 0 from fn_svh_post and still closes POSTED. "posted — 0 ledger
   * rows" reads like a failure on the one document type where it is the best
   * possible outcome.
   */
  it('says how many lines varied, not how many ledger rows were written', async () => {
    // The captured run: MILK agreed, SALT was short 2, SUGAR over 3.
    service.post.mockResolvedValue(postResult([line(1, 0), line(2, -2), line(3, 3)], 2));

    const response = await post();

    expect(response.message).toBe('Physical stock count posted — 2 of 3 lines had a variance');
    // The honest number stays in the payload for anyone who wants it.
    expect(response.data.rowsPosted).toBe(2);
  });

  it('calls a count where everything agreed a success, and says so', async () => {
    service.post.mockResolvedValue(postResult([line(1, 0), line(2, 0)], 0));

    const response = await post();

    expect(response.success).toBe(true);
    expect(response.message).toBe('Physical stock count posted — all 2 lines agreed with the book');
    expect(response.data.status).toBe('POSTED');
  });

  it('counts a line with no diffQty as one that agreed', async () => {
    service.post.mockResolvedValue(postResult([line(1, null), line(2, 4)], 1));

    const response = await post();

    expect(response.message).toBe('Physical stock count posted — 1 of 2 lines had a variance');
  });

  it('pins PHYSICAL, and hands the service a record no payload can reach', async () => {
    service.post.mockResolvedValue(postResult([line(1, -1)], 1));

    await post();

    // jest's mock.calls is any[][]; naming the tuple is what lets the
    // assertions below read as type-checked field accesses rather than as
    // unsafe member access on `any`.
    const [rules] = service.post.mock.calls[0] as [StockVoucherTypeRules];
    expect(rules.voucherType).toBe('PHYSICAL');
    expect(rules.typeCode).toBe('PHY');
    // The four fields that make a count behave differently from an opening.
    expect(rules.quantityMode).toBe('COUNT');
    expect(rules.defaultRateSource).toBe('AVG_COST');
    expect(rules.allowsRepeatHolding).toBe(true);
    expect(rules.ledgerTxnTypes).toEqual(['PHYSICAL_PLUS', 'PHYSICAL_MINUS']);
  });

  it('reports an empty variance report as agreement, not as an empty result', async () => {
    service.variance.mockResolvedValue({
      items: [],
      meta: { limit: 200, offset: 0, count: 0 },
    });

    const response = await controller.variance({
      svhId: SVH_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });

    expect(response.message).toBe('Every line agreed — the count posted no ledger rows');
  });

  /**
   * The same wording problem as the post message, on the other route: a
   * cancelled DRAFT reverses nothing because nothing had posted, and
   * "cancelled — 0 reversal rows" reads like a failure on the outcome that is
   * now the ordinary way to abandon a count sheet and release its freeze.
   */
  describe('cancel', () => {
    const cancel = () =>
      controller.cancel({
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        reason: 'counter went home',
      });

    it('does not report a cancelled DRAFT as 0 reversal rows', async () => {
      service.cancel.mockResolvedValue(cancelResult(0));

      const response = await cancel();

      expect(response.success).toBe(true);
      expect(response.message).toBe(
        'Physical stock count cancelled successfully — no variance had posted, so nothing was reversed',
      );
      expect(response.data.rowsReversed).toBe(0);
    });

    it('counts the reversal rows when a POSTED count is cancelled', async () => {
      service.cancel.mockResolvedValue(cancelResult(2));

      const response = await cancel();

      expect(response.message).toBe(
        'Physical stock count cancelled successfully — 2 reversal rows',
      );
    });

    it('pins PHYSICAL on cancel too, and passes the reason through', async () => {
      service.cancel.mockResolvedValue(cancelResult(0));

      await cancel();

      const [rules, , , reason] = service.cancel.mock.calls[0] as [
        StockVoucherTypeRules,
        string,
        string,
        string,
      ];
      expect(rules.voucherType).toBe('PHYSICAL');
      // The generic entry point is what makes the draft path reachable at all:
      // the service refuses a draft cancellation on any type whose
      // postFunction is a transfer's.
      expect(rules.postShape).toBe('COUNT');
      expect(reason).toBe('counter went home');
    });
  });
});
