import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveTenderTypeMasterDto } from './save-tender-type-master.dto';

const BODY = { ttmTypeName: 'WALLET' };

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

describe('SaveTenderTypeMasterDto (through the house pipe)', () => {
  it('accepts a new type naming only its name', async () => {
    await expect(refusedFields(BODY, SaveTenderTypeMasterDto)).resolves.toEqual([]);
  });

  it('accepts every field at its length limit', async () => {
    await expect(
      refusedFields(
        {
          ttmTypeId: '12',
          ttmTypeName: 'N'.repeat(50),
          ttmDisplayName: 'D'.repeat(50),
          ttmIsActive: false,
        },
        SaveTenderTypeMasterDto,
      ),
    ).resolves.toEqual([]);
  });

  it('trims the name and the display name', async () => {
    const dto = await validateDto(
      { ttmTypeName: '  WALLET ', ttmDisplayName: ' Wallet ' },
      SaveTenderTypeMasterDto,
    );

    expect(dto).toMatchObject({ ttmTypeName: 'WALLET', ttmDisplayName: 'Wallet' });
  });

  it.each([
    ['a numeric id', 12, '12'],
    ['a padded string id', ' 12 ', '12'],
  ])('reads %s as the id string', async (_label, ttmTypeId, expected) => {
    const dto = await validateDto({ ...BODY, ttmTypeId }, SaveTenderTypeMasterDto);

    expect(dto.ttmTypeId).toBe(expected);
  });

  // A blank id reads as "no id", so the save creates rather than updates.
  it.each([[''], ['  '], [null]])('treats an id of %p as absent', async (ttmTypeId) => {
    const dto = await validateDto({ ...BODY, ttmTypeId }, SaveTenderTypeMasterDto);

    expect(dto.ttmTypeId).toBeUndefined();
  });

  it.each([
    ['no name', { ttmDisplayName: 'Wallet' }, 'ttmTypeName'],
    ['a blank name', { ttmTypeName: '   ' }, 'ttmTypeName'],
    ['a name over 50 characters', { ttmTypeName: 'N'.repeat(51) }, 'ttmTypeName'],
    [
      'a display name over 50 characters',
      { ...BODY, ttmDisplayName: 'D'.repeat(51) },
      'ttmDisplayName',
    ],
    ['an id that is not a whole number', { ...BODY, ttmTypeId: '1.5' }, 'ttmTypeId'],
    ['a negative id', { ...BODY, ttmTypeId: '-1' }, 'ttmTypeId'],
    ['a key the type does not have', { ...BODY, ttmIsCash: true }, 'ttmIsCash'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveTenderTypeMasterDto)).resolves.toEqual([field]);
  });
});
