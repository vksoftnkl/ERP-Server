import { HttpException } from '@nestjs/common';
import { Prisma, TaxRateLedger, TaxRateMaster } from '@prisma/client';
import { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import { TaxRateErrorCode } from '../types/tax-rate-error-codes';
import {
  CESS_BASES,
  TAX_TAXABILITIES,
  ZERO_ONLY_TAXABILITIES,
  handleTaxRateWriteError,
  pushError,
  toLedgerLinePayload,
  toTaxRatePayload,
} from './tax-rate.utils';

const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46ac01';
const OLD_TAX_ID = '019c6f6c-be87-7a11-8905-36092c46ac02';
const TRL_ID = '019c6f6c-be87-7a11-8905-36092c46ac03';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46ac04';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const rateRow = (overrides: Partial<TaxRateMaster> = {}): TaxRateMaster => ({
  taxId: TAX_ID,
  taxName: 'GST 18%',
  taxCode: 'GST18',
  taxSortOrder: 3,
  taxTaxability: 'TAXABLE',
  taxIsReverseCharge: false,
  taxRatePerc: new Prisma.Decimal(18),
  taxCgstPerc: new Prisma.Decimal(9),
  taxSgstPerc: new Prisma.Decimal(9),
  taxIgstPerc: new Prisma.Decimal(18),
  taxCessBasis: 'NONE',
  taxCessPerc: new Prisma.Decimal(0),
  taxCessPerUnit: new Prisma.Decimal(0),
  taxAcessBasis: 'NONE',
  taxAcessPerc: new Prisma.Decimal(0),
  taxAcessPerUnit: new Prisma.Decimal(0),
  taxSupersedesId: null,
  taxIsActive: true,
  taxIsDeleted: false,
  taxSyncDate: null,
  taxCreatedOn: CREATED_ON,
  taxCreatedBy: 'admin',
  taxModifiedOn: null,
  taxModifiedBy: null,
  ...overrides,
});

const lineRow = (overrides: Partial<TaxRateLedger> = {}): TaxRateLedger => ({
  trlId: TRL_ID,
  trlTaxId: TAX_ID,
  trlRole: 'OUTPUT_CGST',
  trlSupplyNature: null,
  trlLedgerId: LEDGER_ID,
  trlRemarks: null,
  trlIsActive: true,
  trlIsDeleted: false,
  trlSyncDate: null,
  trlCreatedOn: CREATED_ON,
  trlCreatedBy: 'admin',
  trlModifiedOn: null,
  trlModifiedBy: null,
  ...overrides,
});

const knownError = (code: string, meta?: Record<string, unknown>, message = `Prisma ${code}`) =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: 'test', meta });

/** The status and body of the HttpException a call threw. */
function refusalOf(call: () => void): { status: number; body: unknown } {
  try {
    call();
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() };
    }
    throw error;
  }
  throw new Error('expected the call to throw');
}

describe('tax-rate.utils', () => {
  // ── vocabularies ──────────────────────────────────────────────────────────
  describe('the vocabularies', () => {
    it('keeps ZERO_RATED taxable: it is a taxability, but not one that must charge nothing', () => {
      expect(TAX_TAXABILITIES).toContain('ZERO_RATED');
      expect(ZERO_ONLY_TAXABILITIES).toEqual(['EXEMPT', 'NIL_RATED', 'NON_GST']);
    });

    it('never offers MIXED as a rate taxability', () => {
      expect(TAX_TAXABILITIES).not.toContain('MIXED');
      expect(CESS_BASES).toEqual(['NONE', 'PERCENT', 'PER_UNIT', 'BOTH']);
    });
  });

  // ── payload mapping ───────────────────────────────────────────────────────
  describe('toLedgerLinePayload', () => {
    it('maps a line with its resolved role label and ledger name', () => {
      const modifiedOn = new Date('2026-10-02T00:00:00.000Z');

      expect(
        toLedgerLinePayload({
          ...lineRow({
            trlSupplyNature: 'INTRA',
            trlRemarks: 'Kerala',
            trlModifiedOn: modifiedOn,
            trlModifiedBy: 'clerk',
            trlSyncDate: modifiedOn,
          }),
          role: { alrLabel: 'Output CGST' },
          ledger: { ledName: 'CGST Output 9%' },
        }),
      ).toEqual({
        trl_id: TRL_ID,
        trl_tax_id: TAX_ID,
        trl_role: 'OUTPUT_CGST',
        trl_role_label: 'Output CGST',
        trl_supply_nature: 'INTRA',
        trl_ledger_id: LEDGER_ID,
        trl_ledger_name: 'CGST Output 9%',
        trl_remarks: 'Kerala',
        trl_is_active: true,
        trl_is_deleted: false,
        trl_sync_date: '2026-10-02T00:00:00.000Z',
        trl_created_on: CREATED_ON.toISOString(),
        trl_created_by: 'admin',
        trl_modified_on: '2026-10-02T00:00:00.000Z',
        trl_modified_by: 'clerk',
      });
    });

    it('answers null names for a bare row, as the write paths audit it', () => {
      expect(toLedgerLinePayload(lineRow())).toMatchObject({
        trl_role_label: null,
        trl_ledger_name: null,
        trl_sync_date: null,
        trl_modified_on: null,
      });
    });
  });

  describe('toTaxRatePayload', () => {
    it('turns every Decimal into a number and keeps the generated split', () => {
      expect(
        toTaxRatePayload({
          ...rateRow({
            taxCessBasis: 'BOTH',
            taxCessPerc: new Prisma.Decimal('1.5'),
            taxCessPerUnit: new Prisma.Decimal('0.75'),
            taxSupersedesId: OLD_TAX_ID,
          }),
          supersedes: { taxName: 'GST 12%' },
          ledgerOverrides: [{ ...lineRow(), role: { alrLabel: 'Output CGST' }, ledger: null }],
        }),
      ).toEqual({
        tax_id: TAX_ID,
        tax_name: 'GST 18%',
        tax_code: 'GST18',
        tax_sort_order: 3,
        tax_taxability: 'TAXABLE',
        tax_is_reverse_charge: false,
        tax_rate_perc: 18,
        tax_cgst_perc: 9,
        tax_sgst_perc: 9,
        tax_igst_perc: 18,
        tax_cess_basis: 'BOTH',
        tax_cess_perc: 1.5,
        tax_cess_per_unit: 0.75,
        tax_acess_basis: 'NONE',
        tax_acess_perc: 0,
        tax_acess_per_unit: 0,
        tax_supersedes_id: OLD_TAX_ID,
        tax_supersedes_name: 'GST 12%',
        tax_is_active: true,
        tax_is_deleted: false,
        tax_sync_date: null,
        tax_created_on: CREATED_ON.toISOString(),
        tax_created_by: 'admin',
        tax_modified_on: null,
        tax_modified_by: null,
        lines: [
          expect.objectContaining({
            trl_id: TRL_ID,
            trl_role_label: 'Output CGST',
            trl_ledger_name: null,
          }),
        ],
      });
    });

    it('answers null for generated columns a fresh row has not computed, and no lines', () => {
      const payload = toTaxRatePayload(
        rateRow({
          taxCgstPerc: null,
          taxSgstPerc: null,
          taxIgstPerc: null,
          taxModifiedOn: new Date('2026-10-03T00:00:00.000Z'),
          taxSyncDate: new Date('2026-10-04T00:00:00.000Z'),
        }),
      );

      expect(payload).toMatchObject({
        tax_cgst_perc: null,
        tax_sgst_perc: null,
        tax_igst_perc: null,
        tax_supersedes_name: null,
        tax_modified_on: '2026-10-03T00:00:00.000Z',
        tax_sync_date: '2026-10-04T00:00:00.000Z',
        lines: [],
      });
    });
  });

  // ── errors ────────────────────────────────────────────────────────────────
  describe('handleTaxRateWriteError', () => {
    it.each([
      ['a column list naming tax_code', { target: ['tax_code'] }, 'tax_code'],
      ['an index name naming tax_name', { target: 'ux_tax_name' }, 'tax_name'],
      ['the grid index', { target: 'ux_trl_rate_role' }, 'lines'],
      ['an index it cannot place', { target: 'some_other_index' }, 'request'],
    ])('turns a unique-index race on %s into a 409', (_label, meta, field) => {
      expect(refusalOf(() => handleTaxRateWriteError(knownError('P2002', meta)))).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Duplicate tax rate data is not allowed',
          errors: [
            {
              field,
              code: TaxRateErrorCode.DUPLICATE,
              message: 'A record with the same value already exists',
            },
          ],
        },
      });
    });

    it('reads the error message when Prisma gave no target', () => {
      const error = knownError('P2002', undefined, 'Unique constraint failed on ux_tax_code');

      expect(refusalOf(() => handleTaxRateWriteError(error))).toMatchObject({
        body: { errors: [{ field: 'tax_code' }] },
      });
    });

    it.each([
      ['the supersession chain', 'fk_tax_supersedes', 'tax_supersedes_id'],
      ['a line ledger', 'fk_trl_ledger', 'lines'],
      ['a line role', 'fk_trl_role', 'lines'],
      ['something it cannot place', 'fk_unknown', 'request'],
    ])('turns a missing reference on %s into a 400', (_label, target, field) => {
      expect(refusalOf(() => handleTaxRateWriteError(knownError('P2003', { target })))).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'Validation failed',
          errors: [
            {
              field,
              code: TaxRateErrorCode.REFERENCE_NOT_FOUND,
              message: 'Referenced master record was not found',
            },
          ],
        },
      });
    });

    it('lets every other error through for the caller to rethrow', () => {
      expect(() => handleTaxRateWriteError(knownError('P2025'))).not.toThrow();
      expect(() => handleTaxRateWriteError(new Error('connection reset'))).not.toThrow();
      // A plain object carrying a P2002 code is not a Prisma error.
      expect(() => handleTaxRateWriteError({ code: 'P2002' })).not.toThrow();
    });
  });

  it('pushError collects rather than throws', () => {
    const errors: ModuleErrorDetail[] = [];

    pushError(errors, 'tax_name', 'tax_name is required', TaxRateErrorCode.NAME_REQUIRED);
    pushError(errors, 'tax_rate_perc', 'too high', TaxRateErrorCode.PERC_OUT_OF_RANGE);

    expect(errors).toEqual([
      { field: 'tax_name', code: TaxRateErrorCode.NAME_REQUIRED, message: 'tax_name is required' },
      { field: 'tax_rate_perc', code: TaxRateErrorCode.PERC_OUT_OF_RANGE, message: 'too high' },
    ]);
  });
});
