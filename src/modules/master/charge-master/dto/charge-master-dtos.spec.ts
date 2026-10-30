import { HttpException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { resolveChargeModules } from '../types/charge-master-api.types';
import { GetChargeMasterQueryDto } from './get-charge-master-query.dto';
import { SaveChargeMasterDto } from './save-charge-master.dto';

const CHG_ID = '019c6f6c-be87-7a11-8905-36092c46f601';
const BODY = {
  chgName: 'Freight',
  chgModule: 'P',
  chgMethod: 'FIXED',
  chgType: 'ADD',
  chgApplyOn: 'VALUE',
  chgLedgerCode: '019c6f6c-be87-7a11-8905-36092c46f603',
};
const pipe = createHouseValidationPipe();

const transform = <T extends object>(value: unknown, metatype: Type<T>, type: 'body' | 'query') =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

/** The fields the house pipe refused; [] when it let the value through. */
async function refusedFields<T extends object>(
  value: unknown,
  metatype: Type<T>,
  type: 'body' | 'query' = 'body',
): Promise<string[]> {
  try {
    await transform(value, metatype, type);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('SaveChargeMasterDto (through the house pipe)', () => {
  it('accepts a charge with its required fields', async () => {
    await expect(refusedFields(BODY, SaveChargeMasterDto)).resolves.toEqual([]);
  });

  it('upper-cases the enum-style values', async () => {
    const dto = await transform(
      {
        ...BODY,
        chgModule: 's',
        chgMethod: 'percent',
        chgType: 'deduct',
        chgApplyOn: 'qty',
        chgRole: 'cash_disc',
        chgCostAlloc: 'weight',
      },
      SaveChargeMasterDto,
      'body',
    );

    expect(dto).toMatchObject({
      chgModule: 'S',
      chgMethod: 'PERCENT',
      chgType: 'DEDUCT',
      chgApplyOn: 'QTY',
      chgRole: 'CASH_DISC',
      chgCostAlloc: 'WEIGHT',
    });
  });

  it('lets the nullable fields be cleared', async () => {
    await expect(
      refusedFields(
        {
          ...BODY,
          chgCode: null,
          chgRole: null,
          chgCostAlloc: null,
          chgTaxId: null,
          chgDefaultRate: null,
          chgDispOrder: null,
        },
        SaveChargeMasterDto,
      ),
    ).resolves.toEqual([]);
  });

  it.each([
    ['no name', { ...BODY, chgName: undefined }, 'chgName'],
    ['a name over 100 characters', { ...BODY, chgName: 'N'.repeat(101) }, 'chgName'],
    ['a module outside P / S / B', { ...BODY, chgModule: 'X' }, 'chgModule'],
    ['a method outside the list', { ...BODY, chgMethod: 'BOX' }, 'chgMethod'],
    ['a type outside ADD / DEDUCT', { ...BODY, chgType: 'MULTIPLY' }, 'chgType'],
    ['an apply-on outside the list', { ...BODY, chgApplyOn: 'AREA' }, 'chgApplyOn'],
    ['a role outside the list', { ...BODY, chgRole: 'PACKING' }, 'chgRole'],
    ['a code over 50 characters', { ...BODY, chgCode: 'C'.repeat(51) }, 'chgCode'],
    ['a ledger that is not a uuid', { ...BODY, chgLedgerCode: 'freight' }, 'chgLedgerCode'],
    ['a tax rate that is not a uuid', { ...BODY, chgTaxId: 'gst18' }, 'chgTaxId'],
    ['a key the charge does not have', { ...BODY, chgHsn: '9965' }, 'chgHsn'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveChargeMasterDto)).resolves.toEqual([field]);
  });
});

describe('GetChargeMasterQueryDto (through the house pipe)', () => {
  it('accepts an id or a module, upper-casing the module', async () => {
    await expect(
      refusedFields({ chgId: CHG_ID }, GetChargeMasterQueryDto, 'query'),
    ).resolves.toEqual([]);
    await expect(
      transform({ chgModule: 'p' }, GetChargeMasterQueryDto, 'query'),
    ).resolves.toMatchObject({
      chgModule: 'P',
    });
  });

  it.each([
    ['a module outside P / S / B', { chgModule: 'X' }, 'chgModule'],
    ['an id that is not a uuid', { chgId: 'freight' }, 'chgId'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query, GetChargeMasterQueryDto, 'query')).resolves.toEqual([field]);
  });
});

describe('resolveChargeModules', () => {
  it.each([
    ['P', ['P', 'B']],
    ['S', ['S', 'B']],
    ['B', ['B']],
    ['Z', ['Z']],
  ])('reads %s as %p', (module, modules) => {
    expect(resolveChargeModules(module)).toEqual(modules);
  });
});
