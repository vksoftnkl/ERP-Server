import type { PrismaService } from 'src/database/prisma/prisma.service';
import type { RequestContextService } from 'src/common/request-context/request-context.service';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import type { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import type { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import {
  BRANCH_OUTWARD_MENU_ID,
  STOCK_TRANSFER_MENU_ID,
  StockTransferController,
  TRANSFER_OUT_RULES,
} from './stock-transfer.controller';
import type { StockTransferService } from './stock-transfer.service';

const SVH_ID = '01000000-0000-7000-8000-0000000000f1';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const ACC_YEAR = '2026-2027';

const REF = { svhId: SVH_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

/** The caller's `user_menus` row for menu 41 — every flag granted unless a test revokes one. */
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

describe('StockTransferController', () => {
  let transfers: { save: jest.Mock; getOne: jest.Mock; despatch: jest.Mock };
  let vouchers: {
    list: jest.Mock;
    validate: jest.Mock;
    cancel: jest.Mock;
    recall: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: StockTransferController;
  let rightsRow: Record<string, boolean> | null;
  let rightsRead: jest.Mock;

  beforeEach(() => {
    rightsRow = allRights();
    rightsRead = jest.fn(async () => (rightsRow ? [rightsRow] : []));
    transfers = { save: jest.fn(), getOne: jest.fn(), despatch: jest.fn() };
    vouchers = {
      list: jest.fn(),
      validate: jest.fn(),
      cancel: jest.fn(),
      recall: jest.fn(),
      softDelete: jest.fn(),
    };
    controller = new StockTransferController(
      transfers as unknown as StockTransferService,
      vouchers as unknown as StockVoucherService,
      { $queryRaw: rightsRead } as unknown as PrismaService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  // ── notes 153 E3 — every route is judged on the caller's menu-41 row ───────
  describe('menu 41 rights', () => {
    const body = (header: Record<string, unknown>) =>
      ({ header, lines: [] }) as unknown as SaveStockTransferDto;

    it("reads the caller's user_menus row for menu 41 before a despatch", async () => {
      transfers.despatch.mockResolvedValue({ sameBranch: true, ledgerRows: 2, transitRows: 0 });
      await controller.despatch({ ...REF } as never);

      const [strings, ...values] = rightsRead.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join('?')).toContain('FROM public.user_menus');
      expect(values).toEqual([USER_ID, STOCK_TRANSFER_MENU_ID]);
      expect(STOCK_TRANSFER_MENU_ID).toBe(41);
    });

    it.each([
      ['despatch', 'um_can_post', 'TRF_RIGHT_POST', () => controller.despatch({ ...REF } as never)],
      ['cancel', 'um_can_cancel', 'TRF_RIGHT_CANCEL', () => controller.cancel({ ...REF, reason: 'Keyed twice' } as never)],
      ['delete', 'um_can_delete', 'TRF_RIGHT_DELETE', () => controller.remove(REF as never)],
      ['load', 'um_can_view', 'TRF_RIGHT_VIEW', () => controller.listOrLoad(REF as never)],
      ['list', 'um_can_view', 'TRF_RIGHT_VIEW', () => controller.listOrLoad({ companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR } as never)],
      ['validate', 'um_can_view', 'TRF_RIGHT_VIEW', () => controller.validate(REF as never)],
      ['create', 'um_can_create', 'TRF_RIGHT_CREATE', () => controller.save(body({}))],
      ['edit', 'um_can_edit', 'TRF_RIGHT_EDIT', () => controller.save(body({ svhId: SVH_ID }))],
    ])('%s: 403 naming the column when the row lacks the right (%s → %s)', async (_route, column, code, call) => {
      rightsRow = { ...allRights(), [column]: false };

      await expect(call()).rejects.toMatchObject({
        status: 403,
        response: { errors: [expect.objectContaining({ code, field: 'userId' })] },
      });
      for (const fn of [...Object.values(transfers), ...Object.values(vouchers)]) {
        expect(fn).not.toHaveBeenCalled();
      }
    });

    it('a save that also despatches needs the post right as well as create', async () => {
      rightsRow = { ...allRights(), um_can_post: false };

      await expect(controller.save(body({ post: true }))).rejects.toMatchObject({
        response: { errors: [expect.objectContaining({ code: 'TRF_RIGHT_POST' })] },
      });
      await expect(controller.save(body({ status: 'POSTED' }))).rejects.toMatchObject({
        response: { errors: [expect.objectContaining({ code: 'TRF_RIGHT_POST' })] },
      });
      expect(transfers.save).not.toHaveBeenCalled();
    });

    it('a caller with no row, or no login, has no rights', async () => {
      rightsRow = null;
      await expect(controller.listOrLoad(REF as never)).rejects.toMatchObject({ status: 403 });

      const anonymous = new StockTransferController(
        transfers as unknown as StockTransferService,
        vouchers as unknown as StockVoucherService,
        { $queryRaw: rightsRead } as unknown as PrismaService,
        { getUserId: () => null } as unknown as RequestContextService,
      );
      rightsRow = allRights();
      await expect(anonymous.validate(REF as never)).rejects.toMatchObject({ status: 403 });
      expect(transfers.getOne).not.toHaveBeenCalled();
      expect(vouchers.validate).not.toHaveBeenCalled();
    });
  });

  // ── the rule record ───────────────────────────────────────────────────────
  it('describes a despatch: TRANSFER_OUT shape, lot required, cost stamped by the engine', () => {
    expect(TRANSFER_OUT_RULES).toMatchObject({
      voucherType: 'TRANSFER_OUT',
      typeCode: 'TRF',
      isInward: false,
      ledgerTxnTypes: ['TRANSFER_OUT'],
      defaultRateSource: 'AVG_COST',
      allowsRepeatHolding: true,
      allowsCount: false,
      allowsLoading: true,
      statusDocType: TxnStatusDocType.STOCK_TRANSFER,
      refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_IN', 'REPACK_IN', 'REPACK_OUT'],
    });
  });

  // ── save ──────────────────────────────────────────────────────────────────
  it.each([
    ['a new transfer', undefined, 'Stock transfer created successfully'],
    ['an edited transfer', SVH_ID, 'Stock transfer updated successfully'],
  ])('saves %s through the transfer checks', async (_label, svhId, message) => {
    const doc = { header: { svhId: SVH_ID }, lines: [] };
    transfers.save.mockResolvedValue(doc);
    const dto = { header: { svhId }, lines: [] } as unknown as SaveStockTransferDto;

    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: doc });
    expect(transfers.save).toHaveBeenCalledWith(TRANSFER_OUT_RULES, dto);
  });

  // ── get ───────────────────────────────────────────────────────────────────
  describe('listOrLoad', () => {
    it('loads one transfer with its transit rows when svhId is sent', async () => {
      const doc = { header: { svhId: SVH_ID }, lines: [], transit: [] };
      transfers.getOne.mockResolvedValue(doc);

      await expect(controller.listOrLoad(REF as never)).resolves.toEqual({
        success: true,
        message: 'Stock transfer fetched successfully',
        data: doc,
      });
      expect(transfers.getOne).toHaveBeenCalledWith(
        TRANSFER_OUT_RULES,
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
      );
      expect(vouchers.list).not.toHaveBeenCalled();
    });

    it('lists through the shared voucher service otherwise', async () => {
      const list = { items: [], meta: { page: 1, limit: 20, total: 0 } };
      vouchers.list.mockResolvedValue(list);
      const query = { accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

      await expect(controller.listOrLoad(query as never)).resolves.toEqual({
        success: true,
        message: 'Stock transfer list fetched successfully',
        data: list,
      });
      expect(vouchers.list).toHaveBeenCalledWith(TRANSFER_OUT_RULES, query);
      expect(transfers.getOne).not.toHaveBeenCalled();
    });
  });

  // ── validate ──────────────────────────────────────────────────────────────
  it.each([
    [[{ problem: null }, { problem: 'lot is short' }], '1 of 2 lines have problems'],
    [[{ problem: null }], 'All 1 lines are clean'],
  ])('words a preflight of %j as "%s"', async (rows, message) => {
    vouchers.validate.mockResolvedValue(rows);

    await expect(controller.validate(REF)).resolves.toEqual({ success: true, message, data: rows });
    expect(vouchers.validate).toHaveBeenCalledWith(
      TRANSFER_OUT_RULES,
      SVH_ID,
      ACC_YEAR,
      COMPANY_ID,
      BRANCH_ID,
    );
  });

  // ── despatch ──────────────────────────────────────────────────────────────
  describe('despatch', () => {
    it('says a same-branch move POSTED, with its ledger rows', async () => {
      transfers.despatch.mockResolvedValue({ sameBranch: true, ledgerRows: 2, transitRows: 0 });
      const dto = { ...REF, userId: USER_ID, lrNo: 'LR-1' };

      await expect(controller.despatch(dto)).resolves.toMatchObject({
        success: true,
        message: 'Stock moved between godowns — 2 ledger rows, transfer POSTED',
      });
      expect(transfers.despatch).toHaveBeenCalledWith(TRANSFER_OUT_RULES, dto);
    });

    it('says an inter-branch despatch is in transit, with its lines', async () => {
      transfers.despatch.mockResolvedValue({ sameBranch: false, ledgerRows: 1, transitRows: 3 });

      await expect(controller.despatch(REF)).resolves.toMatchObject({
        message: 'Transfer despatched — 3 lines in transit',
      });
    });
  });

  // ── cancel / delete ───────────────────────────────────────────────────────
  it('cancels through the shared service with the reason and user, and counts the reversal', async () => {
    vouchers.cancel.mockResolvedValue({ rowsReversed: 2 });

    await expect(
      controller.cancel({ ...REF, reason: 'wrong godown', userId: USER_ID }),
    ).resolves.toEqual({
      success: true,
      message: 'Stock transfer cancelled — 2 reversal rows',
      data: { rowsReversed: 2 },
    });
    expect(vouchers.cancel).toHaveBeenCalledWith(
      TRANSFER_OUT_RULES,
      SVH_ID,
      ACC_YEAR,
      'wrong godown',
      COMPANY_ID,
      BRANCH_ID,
      USER_ID,
    );
  });

  // ── notes 160 B — recall an untouched branch despatch ─────────────────────
  describe('recall', () => {
    it('is judged on menu 192 (Branch Outward), CANCEL — not on menu 41', async () => {
      vouchers.recall.mockResolvedValue({
        header: { refno: 'TRF/2026-2027/D1/00017' },
        rowsReversed: 2,
        transitRowsClosed: 2,
      });

      const result = await controller.recall({ ...REF, reason: 'Lorry never left', userId: USER_ID } as never);

      const [, ...values] = rightsRead.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(values).toEqual([USER_ID, BRANCH_OUTWARD_MENU_ID]);
      expect(BRANCH_OUTWARD_MENU_ID).toBe(192);
      expect(vouchers.recall).toHaveBeenCalledWith(
        TRANSFER_OUT_RULES,
        SVH_ID,
        ACC_YEAR,
        'Lorry never left',
        COMPANY_ID,
        BRANCH_ID,
        USER_ID,
      );
      expect(result.message).toBe(
        'TRF/2026-2027/D1/00017 recalled — 2 reversal rows, 2 transit rows closed',
      );
    });

    it('refuses 403 TRF_RIGHT_CANCEL without cancel on menu 192', async () => {
      rightsRow = { ...allRights(), um_can_cancel: false };

      await expect(
        controller.recall({ ...REF, reason: 'Lorry never left' } as never),
      ).rejects.toMatchObject({
        status: 403,
        response: { errors: [expect.objectContaining({ code: 'TRF_RIGHT_CANCEL' })] },
      });
      expect(vouchers.recall).not.toHaveBeenCalled();
    });
  });

  it('deletes a draft rather than cancelling it', async () => {
    vouchers.softDelete.mockResolvedValue({ svhId: SVH_ID, deleted: true });

    await expect(controller.remove(REF)).resolves.toEqual({
      success: true,
      message: 'Stock transfer deleted successfully',
      data: { svhId: SVH_ID, deleted: true },
    });
    const [rules] = vouchers.softDelete.mock.calls[0] as [StockVoucherTypeRules];
    expect(rules).toBe(TRANSFER_OUT_RULES);
    expect(vouchers.softDelete).toHaveBeenCalledWith(
      TRANSFER_OUT_RULES,
      SVH_ID,
      ACC_YEAR,
      COMPANY_ID,
      BRANCH_ID,
    );
  });
});
