import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveTenderMasterDto } from './save-tender-master.dto';

const BODY = {
  tndCompanyId: '019c6f6c-be87-7a11-8905-36092c46f703',
  tndTypeId: '1',
  tndName: 'Cash',
  tndLedgerId: '019c6f6c-be87-7a11-8905-36092c46f705',
  tndMinAmount: 0,
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

describe('SaveTenderMasterDto (through the house pipe)', () => {
  it('accepts a tender with its required fields', async () => {
    await expect(refusedFields(BODY, SaveTenderMasterDto)).resolves.toEqual([]);
  });

  it('reads a numeric type id and a string amount', async () => {
    const dto = await validateDto(
      { ...BODY, tndTypeId: 6, tndMinAmount: '100' },
      SaveTenderMasterDto,
    );

    expect(dto).toMatchObject({ tndTypeId: '6', tndMinAmount: 100 });
  });

  it.each([['#00A3FF'], ['#00a3ff80']])('accepts the colour %s', async (tndColour) => {
    await expect(refusedFields({ ...BODY, tndColour }, SaveTenderMasterDto)).resolves.toEqual([]);
  });

  it.each([
    ['no company', { ...BODY, tndCompanyId: undefined }, 'tndCompanyId'],
    ['a type id that is not a whole number', { ...BODY, tndTypeId: '1.5' }, 'tndTypeId'],
    ['no name', { ...BODY, tndName: undefined }, 'tndName'],
    ['a short name over 30 characters', { ...BODY, tndShortName: 'S'.repeat(31) }, 'tndShortName'],
    ['a negative minimum', { ...BODY, tndMinAmount: -1 }, 'tndMinAmount'],
    ['a negative maximum', { ...BODY, tndMaxAmount: -1 }, 'tndMaxAmount'],
    ['settlement days over 90', { ...BODY, tndSettlementDays: 91 }, 'tndSettlementDays'],
    ['a surcharge over 100%', { ...BODY, tndSurchargePerc: 101 }, 'tndSurchargePerc'],
    ['a zero conversion rate', { ...BODY, tndConversionRate: 0 }, 'tndConversionRate'],
    ['a colour that is not hex', { ...BODY, tndColour: 'blue' }, 'tndColour'],
    ['a hotkey over 10 characters', { ...BODY, tndHotkey: 'CTRL+SHIFT+F12' }, 'tndHotkey'],
    [
      'an effective date that is not ISO',
      { ...BODY, tndEffectiveFrom: '01/04/2026' },
      'tndEffectiveFrom',
    ],
    ['a key the tender does not have', { ...BODY, tndCode: 'CSH' }, 'tndCode'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveTenderMasterDto)).resolves.toEqual([field]);
  });
});
