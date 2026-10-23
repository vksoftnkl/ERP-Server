import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveSupplierGroupDto } from './save-supplier-group.dto';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f001';
const BODY = { spgName: 'Fabric Mills' };

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

describe('SaveSupplierGroupDto (through the house pipe)', () => {
  it('accepts a group naming only its name', async () => {
    await expect(refusedFields(BODY, SaveSupplierGroupDto)).resolves.toEqual([]);
  });

  it('accepts every field at its length limit', async () => {
    await expect(
      refusedFields(
        {
          spgId: GROUP_ID,
          spgName: 'N'.repeat(200),
          spgAlias: 'A'.repeat(150),
          spgShort: 'S'.repeat(50),
          spgDesc: 'D'.repeat(250),
          spgIsActive: true,
          spgCreatedBy: 'C'.repeat(100),
          spgModifiedBy: 'M'.repeat(100),
        },
        SaveSupplierGroupDto,
      ),
    ).resolves.toEqual([]);
  });

  it('trims the name', async () => {
    const dto = await validateDto({ spgName: '  Fabric Mills ' }, SaveSupplierGroupDto);

    expect(dto?.spgName).toBe('Fabric Mills');
  });

  // null clears the column on an update; it is not a refusal.
  it('lets the optional text fields be cleared with null', async () => {
    const dto = await validateDto(
      { ...BODY, spgAlias: null, spgShort: null, spgDesc: null },
      SaveSupplierGroupDto,
    );

    expect(dto).toMatchObject({ spgAlias: null, spgShort: null, spgDesc: null });
  });

  it.each([
    ['no name', { spgAlias: 'Mills' }, 'spgName'],
    ['a blank name', { spgName: '   ' }, 'spgName'],
    ['a name over 200 characters', { spgName: 'N'.repeat(201) }, 'spgName'],
    ['an alias over 150 characters', { ...BODY, spgAlias: 'A'.repeat(151) }, 'spgAlias'],
    ['a short name over 50 characters', { ...BODY, spgShort: 'S'.repeat(51) }, 'spgShort'],
    ['a description over 250 characters', { ...BODY, spgDesc: 'D'.repeat(251) }, 'spgDesc'],
    ['a spgId that is not a uuid', { ...BODY, spgId: 'group-1' }, 'spgId'],
    ['a key the group does not have', { ...BODY, spgCode: 'FM' }, 'spgCode'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveSupplierGroupDto)).resolves.toEqual([field]);
  });
});
