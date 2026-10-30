import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveSupplierDto } from './save-supplier.dto';

const LINK_LED_ID = '019c6f6c-be87-7a11-8905-36092c46f506';
const BODY = {
  supGroupId: '019c6f6c-be87-7a11-8905-36092c46f503',
  supPurchaseType: 'LOCAL',
  supName: 'Sri Ganesh Mills',
  supStateName: 'Tamil Nadu',
  supStateCode: '33',
  supGstType: 'REGULAR',
};

/** The fields the house pipe refused; [] when it let the body through. */
async function refusedFields<T extends object>(
  value: unknown,
  metatype: Type<T>,
): Promise<string[]> {
  try {
    await validateDto(value, metatype);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('SaveSupplierDto (through the house pipe)', () => {
  it('accepts a supplier with its required fields', async () => {
    await expect(refusedFields(BODY, SaveSupplierDto)).resolves.toEqual([]);
  });

  it('upper-cases the state code', async () => {
    const dto = await validateDto({ ...BODY, supStateCode: 'tn' }, SaveSupplierDto);

    expect(dto.supStateCode).toBe('TN');
  });

  it.each([
    ['a JSON array', [5, 20]],
    ['a comma-separated string', '5,20'],
  ])('reads collection days given as %s', async (_label, supCollectionDays) => {
    const dto = await validateDto({ ...BODY, supCollectionDays }, SaveSupplierDto);

    expect(dto.supCollectionDays).toEqual([5, 20]);
  });

  // The ledger supplies them: the service fills the blanks from it.
  it('lets a link create leave out the name and state', async () => {
    const { supName: _name, supStateName: _state, supStateCode: _code, ...rest } = BODY;

    await expect(
      refusedFields({ ...rest, supLinkLedId: LINK_LED_ID }, SaveSupplierDto),
    ).resolves.toEqual([]);
  });

  it('still checks a name a link create does send', async () => {
    await expect(
      refusedFields(
        { ...BODY, supLinkLedId: LINK_LED_ID, supName: 'N'.repeat(201) },
        SaveSupplierDto,
      ),
    ).resolves.toEqual(['supName']);
  });

  it.each([
    ['no group', { ...BODY, supGroupId: undefined }, 'supGroupId'],
    ['no name without a link', { ...BODY, supName: undefined }, 'supName'],
    ['no state without a link', { ...BODY, supStateName: undefined }, 'supStateName'],
    ['a state code of one letter', { ...BODY, supStateCode: 'T' }, 'supStateCode'],
    ['no GST type', { ...BODY, supGstType: undefined }, 'supGstType'],
    [
      'a purchase type over 20 characters',
      { ...BODY, supPurchaseType: 'P'.repeat(21) },
      'supPurchaseType',
    ],
    ['an email over 120 characters', { ...BODY, supMailId: 'm'.repeat(121) }, 'supMailId'],
    ['a negative credit period', { ...BODY, supCreditDays: -1 }, 'supCreditDays'],
    ['a link ledger that is not a uuid', { ...BODY, supLinkLedId: 'ledger-1' }, 'supLinkLedId'],
    ['a key the supplier does not have', { ...BODY, supCode: 'SGM' }, 'supCode'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveSupplierDto)).resolves.toEqual([field]);
  });
});
