import type { PrismaService } from 'src/database/prisma/prisma.service';
import type { RequestContextService } from 'src/common/request-context/request-context.service';
import { STOCK_ADJUSTMENT_MENU_ID, StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import type { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46b301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b303';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b304';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b305';
const ACC_YEAR = '2026-2027';

const REF = { svhId: SVH_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

/** The caller's `user_menus` row for menu 264 — every flag granted unless a test revokes one. */
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

describe('StockAdjustmentController', () => {
  let service: {
    save: jest.Mock;
    getOne: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    remove: jest.Mock;
    pickStock: jest.Mock;
  };
  let controller: StockAdjustmentController;
  let rightsRow: Record<string, boolean> | null;
  let rightsRead: jest.Mock;

  beforeEach(() => {
    rightsRow = allRights();
    rightsRead = jest.fn(async () => (rightsRow ? [rightsRow] : []));
    service = {
      save: jest.fn().mockResolvedValue({ svhId: SVH_ID }),
      getOne: jest.fn().mockResolvedValue({ kind: 'RELOT' }),
      validate: jest.fn().mockResolvedValue([]),
      post: jest.fn().mockResolvedValue({ svhId: SVH_ID, rowsPosted: 4 }),
      cancel: jest.fn().mockResolvedValue({ svhId: SVH_ID, rowsReversed: 4 }),
      remove: jest.fn().mockResolvedValue({ svhId: SVH_ID, deleted: true }),
      pickStock: jest.fn().mockResolvedValue([{ sblId: 'a' }, { sblId: 'b' }]),
    };
    controller = new StockAdjustmentController(
      service as unknown as StockAdjustmentService,
      { $queryRaw: rightsRead } as unknown as PrismaService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  const body = (header: Record<string, unknown>) =>
    ({
      header: { voucherType: 'ADJUSTMENT', ...header },
      lines: [],
    }) as unknown as SaveStockAdjustmentDto;

  // ── notes 151 #1 — every route is judged on the caller's menu-264 row ─────
  describe('menu 264 rights', () => {
    it("reads the caller's user_menus row for menu 264 before a post", async () => {
      await controller.post(REF);

      const [strings, ...values] = rightsRead.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join('?')).toContain('FROM public.user_menus');
      expect(values).toEqual([USER_ID, STOCK_ADJUSTMENT_MENU_ID]);
      expect(STOCK_ADJUSTMENT_MENU_ID).toBe(264);
    });

    it.each([
      ['post', 'um_can_post', 'ADJ_RIGHT_POST', () => controller.post(REF)],
      ['cancel', 'um_can_cancel', 'ADJ_RIGHT_CANCEL', () => controller.cancel({ ...REF, reason: 'Keyed twice' })],
      ['delete', 'um_can_delete', 'ADJ_RIGHT_DELETE', () => controller.remove(REF)],
      ['load', 'um_can_view', 'ADJ_RIGHT_VIEW', () => controller.load(REF)],
      ['validate', 'um_can_view', 'ADJ_RIGHT_VIEW', () => controller.validate(REF)],
      ['pick-stock', 'um_can_view', 'ADJ_RIGHT_VIEW', () => controller.pickStock({ companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID })],
      ['create', 'um_can_create', 'ADJ_RIGHT_CREATE', () => controller.save(body({}))],
      ['edit', 'um_can_edit', 'ADJ_RIGHT_EDIT', () => controller.save(body({ svhId: SVH_ID }))],
    ])('%s: 403 naming the column when the row lacks the right (%s → %s)', async (_route, column, code, call) => {
      rightsRow = { ...allRights(), [column]: false };

      await expect(call()).rejects.toMatchObject({
        status: 403,
        response: { errors: [expect.objectContaining({ code, field: 'userId' })] },
      });
      for (const fn of Object.values(service)) {
        expect(fn).not.toHaveBeenCalled();
      }
    });

    it('a save that also posts needs the post right as well as create', async () => {
      rightsRow = { ...allRights(), um_can_post: false };

      await expect(controller.save(body({ post: true }))).rejects.toMatchObject({
        response: { errors: [expect.objectContaining({ code: 'ADJ_RIGHT_POST' })] },
      });
      await expect(controller.save(body({ status: 'POSTED' }))).rejects.toMatchObject({
        response: { errors: [expect.objectContaining({ code: 'ADJ_RIGHT_POST' })] },
      });
      expect(service.save).not.toHaveBeenCalled();
    });

    it('a caller with no row at all has no rights — even to pick stock; a caller with no login neither', async () => {
      rightsRow = null;
      await expect(
        controller.pickStock({ companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID }),
      ).rejects.toMatchObject({ status: 403 });

      const anonymous = new StockAdjustmentController(
        service as unknown as StockAdjustmentService,
        { $queryRaw: rightsRead } as unknown as PrismaService,
        { getUserId: () => null } as unknown as RequestContextService,
      );
      await expect(anonymous.load(REF)).rejects.toMatchObject({ status: 403 });
      expect(service.pickStock).not.toHaveBeenCalled();
      expect(service.getOne).not.toHaveBeenCalled();
    });

    it('the company and branch on the request are not compared with the token (notes 150 #7)', async () => {
      // The token names the login's home company and the device's branch;
      // users post across companies by design. Rights are the gate.
      await expect(
        controller.pickStock({ companyId: '019c6f6c-be87-7a11-8905-36092c46b999', branchId: BRANCH_ID, godownId: GODOWN_ID }),
      ).resolves.toMatchObject({ message: '2 holdings' });
    });
  });

  it('words a save without svhId as a create and one with it as an update', async () => {
    await expect(controller.save(body({}))).resolves.toEqual({
      success: true,
      message: 'Stock adjustment created successfully',
      data: { svhId: SVH_ID },
    });
    await expect(controller.save(body({ svhId: SVH_ID }))).resolves.toMatchObject({
      message: 'Stock adjustment updated successfully',
    });
  });

  it('loads one document by its reference', async () => {
    await expect(controller.load(REF)).resolves.toEqual({
      success: true,
      message: 'Stock adjustment fetched successfully',
      data: { kind: 'RELOT' },
    });
    expect(service.getOne).toHaveBeenCalledWith(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);
  });

  it('counts the lines with problems in the validate message', async () => {
    service.validate.mockResolvedValueOnce([
      { problem: null },
      { problem: 'short' },
      { problem: 'x' },
    ]);
    await expect(controller.validate(REF)).resolves.toMatchObject({
      message: '2 of 3 lines have problems',
    });

    service.validate.mockResolvedValueOnce([{ problem: null }, { problem: null }]);
    await expect(controller.validate(REF)).resolves.toMatchObject({
      message: 'All 2 lines are clean',
    });
  });

  it('reports the ledger rows a post wrote and a cancel reversed', async () => {
    await expect(controller.post(REF)).resolves.toMatchObject({
      message: 'Stock adjustment posted — 4 ledger rows',
    });
    await expect(controller.cancel({ ...REF, reason: 'Keyed twice' })).resolves.toMatchObject({
      message: 'Stock adjustment cancelled — 4 reversal rows',
    });
    expect(service.post).toHaveBeenCalledWith(REF);
    expect(service.cancel).toHaveBeenCalledWith({ ...REF, reason: 'Keyed twice' });
  });

  it('deletes by reference', async () => {
    await expect(controller.remove(REF)).resolves.toEqual({
      success: true,
      message: 'Stock adjustment deleted successfully',
      data: { svhId: SVH_ID, deleted: true },
    });
    expect(service.remove).toHaveBeenCalledWith(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);
  });

  it('counts the holdings the picker found', async () => {
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID };

    await expect(controller.pickStock(query)).resolves.toMatchObject({ message: '2 holdings' });
    expect(service.pickStock).toHaveBeenCalledWith(query);
  });
});
