import { HttpException } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import {
  DeactivateStockReasonDto,
  SaveStockReasonDto,
  StockReasonListQueryDto,
  StockReasonPickerQueryDto,
} from './stock-reason.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b501';
const SRM_ID = '019c6f6c-be87-7a11-8905-36092c46b502';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b503';

const SAVE = { companyId: COMPANY_ID, code: 'THEFT', name: 'Theft', direction: 'OUT' };

/** The fields the house ValidationPipe refused, or [] when it let the value through. */
async function refusedFields(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map((e) => e.field);
  }
}

describe('stock reason DTOs', () => {
  describe('StockReasonPickerQueryDto', () => {
    const pick = (query: Record<string, unknown>) =>
      validateDto({ companyId: COMPANY_ID, ...query }, StockReasonPickerQueryDto, {
        type: 'query',
      });

    // Notes 153 E4 — the two transfer halves pick reasons too.
    it.each(['ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF', 'BUCKET_MOVE', 'TRANSFER_OUT', 'TRANSFER_IN'])(
      'takes %s as the kind',
      async (voucherType) => {
        await expect(refusedFields(pick({ voucherType }))).resolves.toEqual([]);
      },
    );

    it('refuses a kind the screen does not have, and a BOTH direction filter', async () => {
      await expect(refusedFields(pick({ voucherType: 'OPENING' }))).resolves.toEqual([
        'voucherType',
      ]);
      await expect(
        refusedFields(pick({ voucherType: 'ADJUSTMENT', direction: 'BOTH' })),
      ).resolves.toEqual(['direction']);
    });
  });

  it('reads includeInactive from a query string', async () => {
    const query = await validateDto(
      { companyId: COMPANY_ID, includeInactive: 'true' },
      StockReasonListQueryDto,
      { type: 'query' },
    );

    expect(query.includeInactive).toBe(true);
  });

  describe('SaveStockReasonDto', () => {
    const save = (body: Record<string, unknown>) =>
      validateDto({ ...SAVE, ...body }, SaveStockReasonDto);

    it('upper-cases and trims the code', async () => {
      await expect(save({ code: '  theft ' })).resolves.toMatchObject({
        code: 'THEFT',
        name: 'Theft',
      });
    });

    it('accepts a full row', async () => {
      await expect(
        refusedFields(
          save({
            srmId: SRM_ID,
            allowedTxnTypes: ['ADJUST_MINUS', 'DAMAGE'],
            requireRemarks: true,
            glLedgerId: LEDGER_ID,
            sortOrder: 5,
            remarks: null,
            isActive: false,
          }),
        ),
      ).resolves.toEqual([]);
    });

    it.each([
      ['a direction outside IN, OUT, BOTH', { direction: 'SIDEWAYS' }, 'direction'],
      ['a code over 30 characters', { code: 'C'.repeat(31) }, 'code'],
      ['a name over 150 characters', { name: 'n'.repeat(151) }, 'name'],
      ['more than 20 txn types', { allowedTxnTypes: Array(21).fill('DAMAGE') }, 'allowedTxnTypes'],
      ['a txn type over 30 characters', { allowedTxnTypes: ['T'.repeat(31)] }, 'allowedTxnTypes'],
      ['a sort order past 32000', { sortOrder: 32001 }, 'sortOrder'],
      ['a ledger id that is not a uuid', { glLedgerId: 'ledger-1' }, 'glLedgerId'],
      ['a property the DTO does not declare', { srmCode: 'X' }, 'srmCode'],
    ])('refuses %s', async (_label, body, field) => {
      await expect(refusedFields(save(body))).resolves.toEqual([field]);
    });
  });

  describe('DeactivateStockReasonDto', () => {
    it('takes reactivate as a boolean and refuses anything else', async () => {
      await expect(
        refusedFields(
          validateDto(
            { companyId: COMPANY_ID, srmId: SRM_ID, reactivate: true },
            DeactivateStockReasonDto,
          ),
        ),
      ).resolves.toEqual([]);
      await expect(
        refusedFields(validateDto({ companyId: COMPANY_ID, srmId: 'x' }, DeactivateStockReasonDto)),
      ).resolves.toEqual(['srmId']);
    });
  });
});
