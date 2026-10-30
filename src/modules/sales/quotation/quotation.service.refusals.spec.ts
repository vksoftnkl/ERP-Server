import { HttpException } from '@nestjs/common';
import { Prisma, SaleQuotation, SaleQuotationItem, TransactionChargeDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TaxRateErrorCode } from '../../Inventory/tax-rate-master/types/tax-rate-error-codes';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { QuotationService } from './quotation.service';
import { QuotationErrorCode } from './types/quotation-error-codes';

/**
 * The refusals and the update-path rules the older quotation spec does not
 * reach: lookups and deletes that find nothing, the header fields an update
 * rewrites, the line / charge validations, and how a unique violation is named.
 * Every save here is an UPDATE unless it says otherwise, so the voucher
 * numbering (covered in quotation.service.spec.ts) stays out of the way.
 */
const QUOTE_ID = '019c6f6c-be87-7a11-8905-36092c46e701';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e702';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e703';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e704';
const LINE_ID = '019c6f6c-be87-7a11-8905-36092c46e705';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46e706';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46e707';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46e708';
const CHARGE_ID = '019c6f6c-be87-7a11-8905-36092c46e709';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e70a';
const PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46e70b';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e70c';
const ACC_YEAR = '2026-2027';
const CREATED_ON = new Date('2026-07-28T10:00:00.000Z');

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

const quotation = (overrides: Partial<SaleQuotation> = {}): SaleQuotation =>
  ({
    sqId: QUOTE_ID,
    sqCompanyId: COMPANY_ID,
    sqBranchId: BRANCH_ID,
    sqTenantId: null,
    sqAccYear: ACC_YEAR,
    sqPriceLevel: 2,
    sqQuoteSlno: 42n,
    sqQuoteRefno: 'quo00042',
    sqCustName: 'Acme',
    sqStatus: 'DRAFT',
    sqIsDeleted: false,
    sqCancelReason: null,
    sqDeviceId: null,
    sqSessionId: null,
    sqConvertedDocType: null,
    sqConvertedDocId: null,
    sqConvertedOn: null,
    sqCreatedOn: CREATED_ON,
    sqCreatedBy: USER_ID,
    sqModifiedOn: null,
    sqModifiedBy: null,
    sqQuoteDatetime: CREATED_ON,
    sqSyncDate: null,
    ...overrides,
  }) as unknown as SaleQuotation;

const line = (overrides: Partial<SaleQuotationItem> = {}): SaleQuotationItem =>
  ({
    sqiId: LINE_ID,
    sqiQuoteId: QUOTE_ID,
    sqiCompanyId: COMPANY_ID,
    sqiBranchId: BRANCH_ID,
    sqiTenantId: null,
    sqiAccYear: ACC_YEAR,
    sqiLineNo: 1,
    sqiItemId: ITEM_ID,
    sqiItemUnitId: UNIT_ID,
    sqiPriceLevel: 2,
    sqiIsDeleted: false,
    sqiSyncDate: null,
    sqiCreatedOn: CREATED_ON,
    sqiCreatedBy: USER_ID,
    sqiModifiedOn: null,
    sqiModifiedBy: null,
    ...overrides,
  }) as unknown as SaleQuotationItem;

const charge = (overrides: Partial<TransactionChargeDetail> = {}): TransactionChargeDetail =>
  ({
    cdId: 'charge-1',
    cdDocType: 'QUOTATION',
    cdDocId: QUOTE_ID,
    cdSlno: 1,
    cdCompId: COMPANY_ID,
    cdBranchId: BRANCH_ID,
    cdAccYear: ACC_YEAR,
    cdVoucherNo: 42n,
    cdChgId: CHARGE_ID,
    cdChgName: 'Freight',
    cdLedgerCode: LEDGER_ID,
    cdTaxApl: false,
    cdBeforeTax: false,
    cdTaxCode: null,
    cdIsDeleted: false,
    cdSyncDate: null,
    cdCreatedOn: CREATED_ON,
    cdCreatedBy: USER_ID,
    cdModifiedOn: null,
    cdModifiedBy: null,
    ...overrides,
  }) as unknown as TransactionChargeDetail;

const uniqueViolation = (target?: string | string[]) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: target === undefined ? {} : { target },
  });

type Args = { where?: Record<string, unknown>; data?: Record<string, unknown> };

describe('QuotationService — refusals and update-path rules', () => {
  let prisma: {
    saleQuotation: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    saleQuotationItem: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    transactionChargeDetail: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    taxRateMaster: { findMany: jest.Mock };
    saleBill: { findFirst: jest.Mock };
    txnStatusLog: { findFirst: jest.Mock; create: jest.Mock };
    deviceMaster: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let audit: { logEntityChange: jest.Mock };
  let service: QuotationService;

  beforeEach(() => {
    prisma = {
      saleQuotation: {
        findFirst: jest.fn().mockResolvedValue(quotation()),
        update: jest.fn(async ({ data }: Args) =>
          quotation(data as unknown as Partial<SaleQuotation>),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      saleQuotationItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: Args) =>
          line({ ...(data as unknown as Partial<SaleQuotationItem>), sqiId: 'new-line' }),
        ),
        update: jest.fn(async ({ data }: Args) =>
          line(data as unknown as Partial<SaleQuotationItem>),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      transactionChargeDetail: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: Args) =>
          charge({ ...(data as unknown as Partial<TransactionChargeDetail>), cdId: 'new-charge' }),
        ),
        update: jest.fn(async ({ data }: Args) =>
          charge(data as unknown as Partial<TransactionChargeDetail>),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      taxRateMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { taxId: TAX_ID, taxName: 'GST 18', taxIsActive: true, taxIsDeleted: false },
          ]),
      },
      saleBill: { findFirst: jest.fn().mockResolvedValue(null) },
      txnStatusLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: Args) => data),
      },
      deviceMaster: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new QuotationService(
      prisma as unknown as PrismaService,
      audit as never,
      {
        getUserId: () => USER_ID,
      } as never,
    );
  });

  const update = (extra: Record<string, unknown> = {}) =>
    service.save({ sqId: QUOTE_ID, ...extra } as unknown as SaveQuotationDto);
  const headerUpdate = () =>
    prisma.saleQuotation.update.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };

  describe('getById', () => {
    it('refuses a lookup that names neither the id nor the quote number', async () => {
      const refusal = await refusalOf(
        service.getById(undefined, undefined, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'sqId', code: QuotationErrorCode.LOOKUP_KEY_REQUIRED }],
        },
      });
      expect(prisma.saleQuotation.findFirst).not.toHaveBeenCalled();
    });

    it('answers 404 on the quote number when that is what was asked', async () => {
      prisma.saleQuotation.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.getById(undefined, 'quo00099', COMPANY_ID, BRANCH_ID, ACC_YEAR),
      );

      expect(prisma.saleQuotation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sqQuoteRefno: 'quo00099',
            sqCompanyId: COMPANY_ID,
            sqBranchId: BRANCH_ID,
            sqAccYear: ACC_YEAR,
            sqIsDeleted: false,
          },
        }),
      );
      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              field: 'sqQuoteNo',
              message: 'No active quotation found with quote no quo00099',
              code: SALES_ERROR_CODES.NOT_FOUND,
            },
          ],
        },
      });
    });

    it('answers 404 on the id when an id was given', async () => {
      prisma.saleQuotation.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.getById(QUOTE_ID, 'quo00042', COMPANY_ID, BRANCH_ID, ACC_YEAR),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sqId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
    });
  });

  describe('softDelete', () => {
    it('answers 404 for a quotation that is not live in that company, branch and year', async () => {
      prisma.saleQuotation.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.softDelete(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sqId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
      expect(prisma.saleQuotation.updateMany).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('answers 404 when a concurrent delete wins between the read and the write', async () => {
      prisma.saleQuotation.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(
        service.softDelete(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      );

      expect(refusal.status).toBe(404);
      expect(prisma.saleQuotationItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.transactionChargeDetail.updateMany).not.toHaveBeenCalled();
    });

    it('cascades to the lines inside their own year partition, under one actor and instant', async () => {
      await expect(service.softDelete(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
        sqId: QUOTE_ID,
        deleted: true,
      });

      const header = (prisma.saleQuotation.updateMany.mock.calls[0][0] as Args).data!;
      expect(header).toEqual({
        sqIsDeleted: true,
        sqModifiedOn: expect.any(Date) as Date,
        sqModifiedBy: USER_ID,
      });
      expect(prisma.saleQuotationItem.updateMany).toHaveBeenCalledWith({
        where: { sqiQuoteId: QUOTE_ID, sqiAccYear: ACC_YEAR, sqiIsDeleted: false },
        data: { sqiIsDeleted: true, sqiModifiedOn: header.sqModifiedOn, sqiModifiedBy: USER_ID },
      });
    });
  });

  describe('update — the header', () => {
    it('answers 404 for a quotation that is not live', async () => {
      prisma.saleQuotation.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(update({ sqCustName: 'Beta' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sqId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
      expect(prisma.saleQuotation.update).not.toHaveBeenCalled();
    });

    it('aims the write at the stored year, never at one the payload names', async () => {
      prisma.saleQuotation.findFirst.mockResolvedValue(quotation({ sqAccYear: '2025-2026' }));

      await update({ sqAccYear: ACC_YEAR });

      expect(headerUpdate().where).toEqual({
        sqId_sqAccYear: { sqId: QUOTE_ID, sqAccYear: '2025-2026' },
      });
    });

    it('trims a renamed customer and leaves the name alone when it is not sent', async () => {
      await update({ sqCustName: '  Beta Traders  ' });
      expect(headerUpdate().data.sqCustName).toBe('Beta Traders');

      prisma.saleQuotation.update.mockClear();
      await update({ sqRemarks: 'x' });
      expect(headerUpdate().data).not.toHaveProperty('sqCustName');
    });

    it('refuses to blank the customer name', async () => {
      const refusal = await refusalOf(update({ sqCustName: '   ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sqCustName', code: 'VALIDATION_IS_NOT_EMPTY' }] },
      });
      expect(prisma.saleQuotation.update).not.toHaveBeenCalled();
    });

    it('refuses a date field that does not parse, naming it', async () => {
      const refusal = await refusalOf(update({ sqValidUntil: 'next tuesday' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sqValidUntil', code: QuotationErrorCode.INVALID_DATE }] },
      });
    });

    it('clears a date sent as an empty string', async () => {
      await update({ sqValidUntil: '' });

      expect(headerUpdate().data.sqValidUntil).toBeNull();
    });

    it('takes the quotation year for a parent revision that names only its id', async () => {
      await update({ sqParentQuoteId: PARENT_ID });

      expect(headerUpdate().data).toMatchObject({
        sqParentQuoteId: PARENT_ID,
        sqParentAccYear: ACC_YEAR,
      });
    });

    it('keeps a cross-year parent the payload names, and clears both halves on null', async () => {
      await update({ sqParentQuoteId: PARENT_ID, sqParentAccYear: '2025-2026' });
      expect(headerUpdate().data).toMatchObject({ sqParentAccYear: '2025-2026' });

      prisma.saleQuotation.update.mockClear();
      await update({ sqParentQuoteId: null });
      expect(headerUpdate().data).toMatchObject({ sqParentQuoteId: null, sqParentAccYear: null });
    });

    it('files the audit row under the modifier named on the request', async () => {
      await update({ sqModifiedBy: 'counter-2' });

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', userId: 'counter-2' }),
        prisma,
      );
    });
  });

  describe('create — refusals before anything is written', () => {
    it('refuses a blank customer name without opening a transaction', async () => {
      const refusal = await refusalOf(
        service.save({
          sqCompanyId: COMPANY_ID,
          sqBranchId: BRANCH_ID,
          sqAccYear: ACC_YEAR,
          sqCustName: ' ',
        } as SaveQuotationDto),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sqCustName', code: 'VALIDATION_IS_NOT_EMPTY' }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update — the lines', () => {
    it('refuses one line number used twice in the payload, before any write', async () => {
      prisma.saleQuotationItem.findMany.mockResolvedValue([line()]);

      const refusal = await refusalOf(
        update({
          items: [
            { sqiId: LINE_ID, sqiLineNo: 1 },
            { sqiItemId: ITEM_ID, sqiItemUnitId: UNIT_ID, sqiLineNo: 1 },
          ],
        }),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sqiLineNo', code: SALES_ERROR_CODES.LINE_NO_DUPLICATE }] },
      });
      expect(prisma.saleQuotationItem.update).not.toHaveBeenCalled();
      expect(prisma.saleQuotationItem.create).not.toHaveBeenCalled();
    });

    it('answers 404 for a line id that is not an active line of this quotation', async () => {
      const refusal = await refusalOf(update({ items: [{ sqiId: LINE_ID }] }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sqiId', code: SALES_ERROR_CODES.LINE_NOT_FOUND }] },
      });
      expect(prisma.saleQuotationItem.update).not.toHaveBeenCalled();
    });

    it('refuses a new line that names no item, on the field it is missing', async () => {
      const refusal = await refusalOf(update({ items: [{ sqiItemUnitId: UNIT_ID }] }));

      // Status deliberately not pinned: the service answers this missing field
      // with a 404 (requireItemField uses throwSalesNotFound) where bill and
      // sale-order answer 400 for the same rule.
      expect(refusal.body).toMatchObject({
        errors: [{ field: 'sqiItemId', code: SALES_ERROR_CODES.LINE_FIELD_REQUIRED }],
      });
      expect(prisma.saleQuotationItem.create).not.toHaveBeenCalled();
    });

    it('refuses a line quoting a deleted or inactive tax rate, naming the line', async () => {
      prisma.taxRateMaster.findMany.mockResolvedValue([
        { taxId: TAX_ID, taxName: 'GST 18', taxIsActive: false, taxIsDeleted: false },
      ]);

      const refusal = await refusalOf(
        update({
          items: [
            { sqiItemId: ITEM_ID, sqiItemUnitId: UNIT_ID },
            { sqiItemId: ITEM_ID, sqiItemUnitId: UNIT_ID, sqiTaxId: TAX_ID },
          ],
        }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'items.1.sqiTaxId', code: TaxRateErrorCode.REF_INACTIVE }],
        },
      });
      expect(prisma.saleQuotationItem.create).not.toHaveBeenCalled();
    });

    it('stores a new line in the header year and price level, numbered by position', async () => {
      await update({
        items: [{ sqiItemId: ITEM_ID, sqiItemUnitId: UNIT_ID, sqiAccYear: '1999-2000' }],
      });

      expect(prisma.saleQuotationItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sqiQuoteId: QUOTE_ID,
          sqiAccYear: ACC_YEAR,
          sqiCompanyId: COMPANY_ID,
          sqiBranchId: BRANCH_ID,
          sqiLineNo: 1,
          sqiPriceLevel: 2,
          sqiCreatedBy: USER_ID,
        }) as object,
      });
    });

    it('leaves the lines alone when the payload carries no items key', async () => {
      prisma.saleQuotationItem.findMany.mockResolvedValue([line()]);

      const payload = await update({ sqRemarks: 'note' });

      expect(prisma.taxRateMaster.findMany).not.toHaveBeenCalled();
      expect(prisma.saleQuotationItem.update).not.toHaveBeenCalled();
      expect(payload.items).toEqual([expect.objectContaining({ sqiId: LINE_ID })]);
    });
  });

  describe('update — the charges', () => {
    it('refuses a new charge that names no charge master', async () => {
      const refusal = await refusalOf(update({ charges: [{ cdLedgerCode: LEDGER_ID }] }));

      // Status not pinned, for the same reason as the missing line field above.
      expect(refusal.body).toMatchObject({
        errors: [{ field: 'cdChgId', code: QuotationErrorCode.CHARGE_FIELD_REQUIRED }],
      });
      expect(prisma.transactionChargeDetail.create).not.toHaveBeenCalled();
    });

    it('refuses an explicit null in a column the table requires', async () => {
      const refusal = await refusalOf(
        update({ charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdType: null }] }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'cdType', code: QuotationErrorCode.CHARGE_FIELD_REQUIRED }] },
      });
    });

    it('refuses a tax rate on a charge that carries no GST of its own', async () => {
      const refusal = await refusalOf(
        update({
          charges: [
            { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdTaxApl: false, cdTaxCode: TAX_ID },
          ],
        }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'cdTaxCode', code: QuotationErrorCode.CHARGE_TAX_CODE_UNUSED }],
        },
      });
    });

    it('refuses a tax rate on a before-tax charge even when it is taxable', async () => {
      const refusal = await refusalOf(
        update({
          charges: [
            {
              cdChgId: CHARGE_ID,
              cdLedgerCode: LEDGER_ID,
              cdTaxApl: true,
              cdBeforeTax: true,
              cdTaxCode: TAX_ID,
            },
          ],
        }),
      );

      expect(refusal.status).toBe(400);
      expect(
        (refusal.body as { errors: Array<{ code: string }> }).errors.map((error) => error.code),
      ).toEqual([
        QuotationErrorCode.CHARGE_TAX_EXCLUSIVE,
        QuotationErrorCode.CHARGE_TAX_CODE_UNUSED,
      ]);
    });

    it('lets a charge carrying its own GST name its rate', async () => {
      await update({
        charges: [
          { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdTaxApl: true, cdTaxCode: TAX_ID },
        ],
      });

      expect(prisma.transactionChargeDetail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ cdTaxApl: true, cdTaxCode: TAX_ID }) as object,
      });
    });

    it('refuses a charge rate that is deleted, naming the charge line', async () => {
      prisma.taxRateMaster.findMany.mockResolvedValue([]);

      const refusal = await refusalOf(
        update({
          charges: [
            { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdTaxApl: true, cdTaxCode: TAX_ID },
          ],
        }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'charges.0.cdTaxCode', code: TaxRateErrorCode.REF_NOT_FOUND }],
        },
      });
    });

    it("stamps a new charge with the quotation's own serial unless the payload sends one", async () => {
      await update({
        charges: [
          { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID },
          { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdVoucherNo: '77' },
          { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdVoucherNo: '' },
        ],
      });

      const voucherNos = prisma.transactionChargeDetail.create.mock.calls.map(
        ([args]) => (args as Args).data!.cdVoucherNo,
      );
      expect(voucherNos).toEqual([42n, 77n, null]);
    });
  });

  describe('naming a unique violation', () => {
    it('reports the serial-number index as a taken serial', async () => {
      prisma.saleQuotation.update.mockRejectedValue(
        uniqueViolation('sale_quotation_2026_2027_sq_company_id_sq_branch_id_sq_acc_idx1'),
      );
      prisma.$queryRaw.mockResolvedValue([{ parentIndex: 'ux_sq_slno' }]);

      const refusal = await refusalOf(update({ sqRemarks: 'x' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sqQuoteSlno', code: QuotationErrorCode.SLNO_TAKEN }] },
      });
    });

    it('falls back to the quote number when the violation names no index', async () => {
      prisma.saleQuotation.update.mockRejectedValue(uniqueViolation());

      const refusal = await refusalOf(update({ sqRemarks: 'x' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sqQuoteRefno', code: QuotationErrorCode.QUOTE_NO_TAKEN }] },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('reads the reported name itself when the partition lookup fails', async () => {
      prisma.saleQuotation.update.mockRejectedValue(uniqueViolation('ux_sq_slno'));
      prisma.$queryRaw.mockRejectedValue(new Error('permission denied for pg_inherits'));

      const refusal = await refusalOf(update({ sqRemarks: 'x' }));

      expect(refusal.body).toMatchObject({
        errors: [{ code: QuotationErrorCode.SLNO_TAKEN }],
      });
    });

    it('joins a column-list target before matching it', async () => {
      prisma.saleQuotationItem.findMany.mockResolvedValue([line()]);
      prisma.saleQuotationItem.update.mockRejectedValue(
        uniqueViolation(['ux_sqi_quote_line', 'sqi_line_no']),
      );

      const refusal = await refusalOf(update({ items: [{ sqiId: LINE_ID }] }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sqiLineNo', code: SALES_ERROR_CODES.LINE_NO_DUPLICATE }] },
      });
    });

    it('rethrows a failure that is not a unique violation', async () => {
      const failure = new Error('connection reset');
      prisma.saleQuotation.update.mockRejectedValue(failure);

      await expect(update({ sqRemarks: 'x' })).rejects.toBe(failure);
    });
  });

  describe('syncQuotationConversion', () => {
    const ref = {
      srcDocId: QUOTE_ID,
      srcAccYear: ACC_YEAR,
      fields: { docId: 'sbSrcDocId', accYear: 'sbSrcDocYear' },
    };

    it("answers 400 on the caller's field when a concurrent delete beats the write", async () => {
      prisma.saleBill.findFirst.mockResolvedValue({ sbId: BILL_ID, sbCreatedOn: CREATED_ON });
      prisma.saleQuotation.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(
        service.syncQuotationConversion(
          prisma as unknown as Prisma.TransactionClient,
          { refs: [ref] },
          USER_ID,
          new Date(),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbSrcDocId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
      expect(prisma.txnStatusLog.create).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('trims the year before keying the quotation it recomputes', async () => {
      await service.syncQuotationConversion(
        prisma as unknown as Prisma.TransactionClient,
        { refs: [{ ...ref, srcAccYear: ` ${ACC_YEAR} ` }] },
        USER_ID,
        new Date(),
      );

      expect(prisma.saleQuotation.findFirst).toHaveBeenCalledWith({
        where: { sqId: QUOTE_ID, sqAccYear: ACC_YEAR, sqIsDeleted: false },
      });
    });
  });
});
