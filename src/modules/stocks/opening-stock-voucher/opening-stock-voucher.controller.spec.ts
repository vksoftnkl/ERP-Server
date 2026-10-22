import { HttpException } from '@nestjs/common';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import type { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type {
  StockVoucherCancelResult,
  StockVoucherImportResult,
  StockVoucherLineProblem,
  StockVoucherPostResult,
  StockVoucherSaveResult,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import { StockErrorCode } from '../types/stock-error-codes';
import type { SaveOpeningStockVoucherDto } from './dto/save-opening-stock-voucher.dto';
import type { OpeningStockLookupService } from './opening-stock-lookup.service';
import { OpeningStockVoucherController } from './opening-stock-voucher.controller';
import type { OpeningStockItemLookup } from './types/opening-stock-lookup.types';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const ACC_YEAR = '2026-2027';

const REF = { svhId: SVH_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

const problem = (lineNo: number, text: string | null): StockVoucherLineProblem =>
  ({ lineNo, problem: text }) as unknown as StockVoucherLineProblem;

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

describe('OpeningStockVoucherController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    importLines: jest.Mock;
    reconcile: jest.Mock;
  };
  let lookup: { lookupItem: jest.Mock };
  let controller: OpeningStockVoucherController;

  beforeEach(() => {
    service = {
      save: jest.fn(),
      getById: jest.fn().mockResolvedValue({ header: { svhId: SVH_ID }, lines: [] }),
      validate: jest.fn(),
      post: jest.fn(),
      cancel: jest.fn(),
      importLines: jest.fn(),
      reconcile: jest.fn().mockResolvedValue({ items: [], meta: { limit: 200, offset: 0 } }),
    };
    lookup = { lookupItem: jest.fn() };
    controller = new OpeningStockVoucherController(
      service as unknown as StockVoucherService,
      lookup as unknown as OpeningStockLookupService,
    );
  });

  /** The rule record handed to the service on its first call of `method`. */
  const rulesOf = (method: jest.Mock): StockVoucherTypeRules =>
    (method.mock.calls[0] as [StockVoucherTypeRules])[0];

  // ── the rule record ───────────────────────────────────────────────────────
  describe('the route pins OPENING', () => {
    it('hands the service the opening record, whatever the payload says', async () => {
      service.save.mockResolvedValue({ header: {}, lines: [], rowsPosted: null });

      await controller.save({
        header: { voucherType: 'OPENING' },
        lines: [],
      } as unknown as SaveOpeningStockVoucherDto);

      const rules = rulesOf(service.save);
      expect(rules).toMatchObject({
        voucherType: 'OPENING',
        typeCode: 'OPN',
        refnoVchrTypeId: 1,
        isInward: true,
        requiresToGodown: true,
        requiresFromGodown: false,
        ledgerTxnTypes: ['OPENING'],
        quantityMode: 'QTY',
        allowsCount: false,
        allowsToBranch: false,
        statusDocType: TxnStatusDocType.OPENING_STOCK,
        postShape: 'SIMPLE',
      });
    });

    it('names the transfer and repack families it refuses, rather than merely omitting them', async () => {
      service.post.mockResolvedValue({ rowsPosted: 1 });

      await controller.post(REF);

      expect(rulesOf(service.post).refuseTypes).toEqual([
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'REPACK_IN',
        'REPACK_OUT',
      ]);
    });
  });

  // ── item-lookup ───────────────────────────────────────────────────────────
  describe('lookupItem', () => {
    const query = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      itemId: ITEM_ID,
      onDate: '2026-04-01',
    };

    it('fills the line and says so', async () => {
      const item = { itemId: ITEM_ID, itemName: 'Milk 500ml', alreadyOpened: false };
      lookup.lookupItem.mockResolvedValue(item as unknown as OpeningStockItemLookup);

      await expect(controller.lookupItem(query)).resolves.toEqual({
        success: true,
        message: 'Item fetched successfully',
        data: item,
      });
      expect(lookup.lookupItem).toHaveBeenCalledWith(query);
    });

    it('puts the already-opened warning in the message as well as the flag', async () => {
      lookup.lookupItem.mockResolvedValue({
        itemId: ITEM_ID,
        itemName: 'Milk 500ml',
        alreadyOpened: true,
      } as unknown as OpeningStockItemLookup);

      const response = await controller.lookupItem(query);

      expect(response.message).toBe('Milk 500ml has already been opened in this branch');
      expect(response.data.alreadyOpened).toBe(true);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('save', () => {
    it.each([
      ['a new draft', undefined, null, 'Opening stock created successfully'],
      ['an edited draft', SVH_ID, null, 'Opening stock updated successfully'],
      [
        'a new document saved and posted',
        undefined,
        4,
        'Opening stock created and posted successfully — 4 ledger rows',
      ],
      [
        'an edited document saved and posted',
        SVH_ID,
        0,
        'Opening stock updated and posted successfully — 0 ledger rows',
      ],
    ])('words %s', async (_label, svhId, rowsPosted, message) => {
      const result = { header: { svhId: SVH_ID }, lines: [], rowsPosted };
      service.save.mockResolvedValue(result as unknown as StockVoucherSaveResult);
      const dto = { header: { svhId }, lines: [] } as unknown as SaveOpeningStockVoucherDto;

      await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: result });
      expect(service.save).toHaveBeenCalledWith(expect.anything(), dto);
    });
  });

  // ── get / validate ────────────────────────────────────────────────────────
  it('loads one document by its scope and id', async () => {
    await expect(controller.load(REF)).resolves.toEqual({
      success: true,
      message: 'Opening stock fetched successfully',
      data: { header: { svhId: SVH_ID }, lines: [] },
    });
    expect(service.getById).toHaveBeenCalledWith(
      expect.objectContaining({ voucherType: 'OPENING' }),
      SVH_ID,
      ACC_YEAR,
      COMPANY_ID,
      BRANCH_ID,
    );
  });

  describe('validate', () => {
    it('counts the lines that have problems', async () => {
      const rows = [problem(1, null), problem(2, 'lot is held'), problem(3, 'no cost')];
      service.validate.mockResolvedValue(rows);

      await expect(controller.validate(REF)).resolves.toEqual({
        success: true,
        message: '2 of 3 lines have problems',
        data: rows,
      });
      expect(service.validate).toHaveBeenCalledWith(
        expect.objectContaining({ voucherType: 'OPENING' }),
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
      );
    });

    it('says every line is clean when none has a problem', async () => {
      service.validate.mockResolvedValue([problem(1, null), problem(2, null)]);

      await expect(controller.validate(REF)).resolves.toMatchObject({
        message: 'All 2 lines are clean',
      });
    });
  });

  // ── post / cancel ─────────────────────────────────────────────────────────
  it('posts as the user the body names and reports the ledger rows', async () => {
    const result = { header: { svhId: SVH_ID }, lines: [], rowsPosted: 7 };
    service.post.mockResolvedValue(result as unknown as StockVoucherPostResult);

    await expect(controller.post({ ...REF, userId: USER_ID })).resolves.toEqual({
      success: true,
      message: 'Opening stock posted successfully — 7 ledger rows',
      data: result,
    });
    expect(service.post).toHaveBeenCalledWith(
      expect.objectContaining({ voucherType: 'OPENING' }),
      SVH_ID,
      ACC_YEAR,
      COMPANY_ID,
      BRANCH_ID,
      USER_ID,
    );
  });

  describe('cancel', () => {
    it('counts the reversal rows of a POSTED opening, and passes the reason through', async () => {
      service.cancel.mockResolvedValue({ rowsReversed: 3 } as unknown as StockVoucherCancelResult);

      const response = await controller.cancel({ ...REF, reason: 'wrong godown' });

      expect(response.message).toBe('Opening stock cancelled successfully — 3 reversal rows');
      expect(service.cancel).toHaveBeenCalledWith(
        expect.objectContaining({ voucherType: 'OPENING' }),
        SVH_ID,
        ACC_YEAR,
        'wrong godown',
        COMPANY_ID,
        BRANCH_ID,
        undefined,
      );
    });

    it('does not report a cancelled DRAFT as 0 reversal rows', async () => {
      service.cancel.mockResolvedValue({ rowsReversed: 0 } as unknown as StockVoucherCancelResult);

      await expect(controller.cancel({ ...REF, reason: 'abandoned' })).resolves.toMatchObject({
        message:
          'Opening stock cancelled successfully — no stock had moved, so nothing was reversed',
      });
    });
  });

  // ── import ────────────────────────────────────────────────────────────────
  describe('import', () => {
    const importResult = (problems: StockVoucherLineProblem[], linesImported: number) =>
      ({ linesImported, problems }) as unknown as StockVoucherImportResult;

    it('hands the decoded CSV to the ordinary save path, scoped to the existing draft', async () => {
      service.importLines.mockResolvedValue(importResult([problem(1, null)], 1));
      const csv = 'item_code,unit_name,qty,cost_rate\nMILK,PCS,10,28\n';

      const response = await controller.import(
        { ...REF, userId: USER_ID },
        { buffer: Buffer.from(csv, 'utf8'), originalname: 'opening.csv' },
      );

      expect(response.message).toBe('1 lines imported, all clean');
      expect(service.importLines).toHaveBeenCalledWith(
        expect.objectContaining({ voucherType: 'OPENING' }),
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
        csv,
        USER_ID,
      );
    });

    it('counts the imported lines that have problems', async () => {
      service.importLines.mockResolvedValue(
        importResult([problem(1, null), problem(2, 'unknown unit'), problem(3, 'no cost')], 3),
      );

      const response = await controller.import(REF, { buffer: Buffer.from('x') });

      expect(response.message).toBe('3 lines imported; 2 have problems');
    });

    it.each([
      ['no file part at all', undefined],
      ['an empty file', { buffer: Buffer.alloc(0) }],
    ])('refuses %s before reading anything', async (_label, file) => {
      const refusal = await refusalOf(controller.import(REF, file));

      expect(refusal).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'No file uploaded',
          errors: [
            {
              field: 'file',
              code: StockErrorCode.IMPORT_FILE_MISSING,
              message: 'Attach the CSV as the "file" part of the form.',
            },
          ],
        },
      });
      expect(service.importLines).not.toHaveBeenCalled();
    });

    it('refuses a file over 5MB and says how big it was', async () => {
      const refusal = await refusalOf(
        controller.import(REF, { buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }),
      );

      expect(refusal).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'File too large',
          errors: [
            {
              field: 'file',
              code: StockErrorCode.IMPORT_FILE_TOO_LARGE,
              message: 'The file is 5120KB; the limit is 5MB.',
            },
          ],
        },
      });
      expect(service.importLines).not.toHaveBeenCalled();
    });

    it('accepts a file of exactly 5MB', async () => {
      service.importLines.mockResolvedValue(importResult([], 0));

      await expect(
        controller.import(REF, { buffer: Buffer.alloc(5 * 1024 * 1024, 'a') }),
      ).resolves.toMatchObject({ success: true });
    });
  });

  // ── reconcile ─────────────────────────────────────────────────────────────
  it('pages the reconciliation with the limit and offset sent', async () => {
    await expect(
      controller.reconcile({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
        limit: 50,
        offset: 100,
      }),
    ).resolves.toMatchObject({
      success: true,
      message: 'Opening reconciliation fetched successfully',
    });
    expect(service.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ voucherType: 'OPENING' }),
      COMPANY_ID,
      BRANCH_ID,
      ACC_YEAR,
      50,
      100,
    );
  });
});
