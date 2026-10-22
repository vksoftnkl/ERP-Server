import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import type { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import type { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import { StockTransferController, TRANSFER_OUT_RULES } from './stock-transfer.controller';
import type { StockTransferService } from './stock-transfer.service';

const SVH_ID = '01000000-0000-7000-8000-0000000000f1';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const ACC_YEAR = '2026-2027';

const REF = { svhId: SVH_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

describe('StockTransferController', () => {
  let transfers: { save: jest.Mock; getOne: jest.Mock; despatch: jest.Mock };
  let vouchers: { list: jest.Mock; validate: jest.Mock; cancel: jest.Mock; softDelete: jest.Mock };
  let controller: StockTransferController;

  beforeEach(() => {
    transfers = { save: jest.fn(), getOne: jest.fn(), despatch: jest.fn() };
    vouchers = { list: jest.fn(), validate: jest.fn(), cancel: jest.fn(), softDelete: jest.fn() };
    controller = new StockTransferController(
      transfers as unknown as StockTransferService,
      vouchers as unknown as StockVoucherService,
    );
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
