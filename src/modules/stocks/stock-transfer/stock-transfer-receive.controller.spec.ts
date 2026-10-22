import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import type { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import {
  StockTransferReceiveController,
  TRANSFER_IN_RULES,
} from './stock-transfer-receive.controller';
import type { StockTransferService } from './stock-transfer.service';

const IN_ID = '01000000-0000-7000-8000-0000000000f2';
const OUT_ID = '01000000-0000-7000-8000-0000000000f1';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_B = '01000000-0000-7000-8000-0000000000b2';
const REASON_ID = '01000000-0000-7000-8000-0000000000e9';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const ACC_YEAR = '2026-2027';

const REF = { svhId: IN_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_B };

describe('StockTransferReceiveController', () => {
  let transfers: {
    inbound: jest.Mock;
    prefill: jest.Mock;
    saveReceive: jest.Mock;
    receive: jest.Mock;
    settleShort: jest.Mock;
  };
  let vouchers: { softDelete: jest.Mock };
  let controller: StockTransferReceiveController;

  beforeEach(() => {
    transfers = {
      inbound: jest.fn(),
      prefill: jest.fn(),
      saveReceive: jest.fn(),
      receive: jest.fn(),
      settleShort: jest.fn(),
    };
    vouchers = { softDelete: jest.fn() };
    controller = new StockTransferReceiveController(
      transfers as unknown as StockTransferService,
      vouchers as unknown as StockVoucherService,
    );
  });

  // ── the rule record ───────────────────────────────────────────────────────
  it('describes a receipt: inward, TRANSFER_IN shape, and it never leaves the branch', () => {
    expect(TRANSFER_IN_RULES).toMatchObject({
      voucherType: 'TRANSFER_IN',
      typeCode: 'TRI',
      isInward: true,
      postShape: 'TRANSFER_IN',
      ledgerTxnTypes: ['TRANSFER_IN'],
      allowsToBranch: false,
      allowsCount: false,
      statusDocType: TxnStatusDocType.STOCK_TRANSFER,
      refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
    });
  });

  // ── inbound ───────────────────────────────────────────────────────────────
  describe('inbound', () => {
    it('pages 100 from the start unless told otherwise', async () => {
      transfers.inbound.mockResolvedValue({ items: [], meta: { limit: 100, offset: 0, count: 4 } });

      await expect(
        controller.inbound({ companyId: COMPANY_ID, branchId: BRANCH_B } as never),
      ).resolves.toMatchObject({
        success: true,
        message: '4 consignments in transit to this branch',
      });
      expect(transfers.inbound).toHaveBeenCalledWith(COMPANY_ID, BRANCH_B, 100, 0);
    });

    it('passes the paging it was sent', async () => {
      transfers.inbound.mockResolvedValue({ items: [], meta: { limit: 10, offset: 20, count: 0 } });

      await controller.inbound({
        companyId: COMPANY_ID,
        branchId: BRANCH_B,
        limit: 10,
        offset: 20,
      } as never);

      expect(transfers.inbound).toHaveBeenCalledWith(COMPANY_ID, BRANCH_B, 10, 20);
    });
  });

  // ── prefill ───────────────────────────────────────────────────────────────
  it('prefills from what is still owed and names the despatch', async () => {
    const prefill = { outVoucher: { refno: 'TRF/2026-2027/TILL-01/2' }, rows: [{}, {}] };
    transfers.prefill.mockResolvedValue(prefill);

    await expect(
      controller.prefill({
        companyId: COMPANY_ID,
        branchId: BRANCH_B,
        outVoucherId: OUT_ID,
        accYear: ACC_YEAR,
      } as never),
    ).resolves.toEqual({
      success: true,
      message: '2 lines still to receive against TRF/2026-2027/TILL-01/2',
      data: prefill,
    });
    expect(transfers.prefill).toHaveBeenCalledWith(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR);
  });

  // ── save ──────────────────────────────────────────────────────────────────
  it.each([
    ['a new receipt', undefined, 'Transfer receipt created successfully'],
    ['an edited receipt', IN_ID, 'Transfer receipt updated successfully'],
  ])('saves %s through the receipt checks', async (_label, svhId, message) => {
    const doc = { header: { svhId: IN_ID }, lines: [] };
    transfers.saveReceive.mockResolvedValue(doc);
    const dto = { header: { svhId }, lines: [] } as unknown as SaveStockTransferReceiveDto;

    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: doc });
    expect(transfers.saveReceive).toHaveBeenCalledWith(TRANSFER_IN_RULES, dto);
  });

  // ── post ──────────────────────────────────────────────────────────────────
  describe('post', () => {
    const received = (closed: boolean) => ({
      inVoucher: { ledgerRows: 2 },
      outVoucher: { refno: 'TRF/x', closed },
    });

    it('says the transfer closed when nothing is left in transit', async () => {
      transfers.receive.mockResolvedValue(received(true));

      await expect(controller.post({ ...REF, userId: USER_ID })).resolves.toMatchObject({
        success: true,
        message: 'Receipt posted — 2 ledger rows, transfer TRF/x closed',
      });
      expect(transfers.receive).toHaveBeenCalledWith(
        TRANSFER_IN_RULES,
        IN_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_B,
        USER_ID,
      );
    });

    it('says the transfer is still open when a short remains', async () => {
      transfers.receive.mockResolvedValue(received(false));

      await expect(controller.post(REF)).resolves.toMatchObject({
        message: 'Receipt posted — 2 ledger rows, transfer TRF/x still open with stock outstanding',
      });
    });
  });

  // ── settle-short ──────────────────────────────────────────────────────────
  it('reports what a short settlement wrote off', async () => {
    transfers.settleShort.mockResolvedValue({
      outVoucher: { refno: 'TRF/x' },
      shortQty: 2,
      shortValue: 56,
    });
    const dto = {
      outVoucherId: OUT_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_B,
      reasonId: REASON_ID,
    };

    await expect(controller.settleShort(dto)).resolves.toMatchObject({
      success: true,
      message: 'TRF/x closed — 2 short, 56 written off',
    });
    expect(transfers.settleShort).toHaveBeenCalledWith(dto);
  });

  // ── delete ────────────────────────────────────────────────────────────────
  it('deletes a receipt draft — never cancels it', async () => {
    vouchers.softDelete.mockResolvedValue({ svhId: IN_ID, deleted: true });

    await expect(controller.remove(REF)).resolves.toEqual({
      success: true,
      message: 'Transfer receipt deleted successfully',
      data: { svhId: IN_ID, deleted: true },
    });
    expect(vouchers.softDelete).toHaveBeenCalledWith(
      TRANSFER_IN_RULES,
      IN_ID,
      ACC_YEAR,
      COMPANY_ID,
      BRANCH_B,
    );
  });
});
