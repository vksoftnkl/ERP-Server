import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveAccGroupMasterDto } from './save-acc-group-master.dto';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f212';
const PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46f211';
const BODY = { accGroupName: 'Debtors - West', accGroupParentId: PARENT_ID };

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

describe('SaveAccGroupMasterDto (through the house pipe)', () => {
  it('accepts a group naming its name and parent', async () => {
    await expect(refusedFields(BODY, SaveAccGroupMasterDto)).resolves.toEqual([]);
  });

  it('accepts every field at its length limit', async () => {
    await expect(
      refusedFields(
        {
          accGroupId: GROUP_ID,
          accGroupName: 'N'.repeat(150),
          accGroupAlias: 'A'.repeat(100),
          accGroupShort: 'S'.repeat(50),
          accGroupDescription: 'D'.repeat(250),
          accGroupParentId: null,
          accGroupSort: 3,
          accGroupBehaveAsSubledger: true,
          accGroupNetDebitCredit: false,
          accGroupUsedForCalculation: true,
          accGroupAffectsGrossProfit: false,
          accGroupIsActive: true,
        },
        SaveAccGroupMasterDto,
      ),
    ).resolves.toEqual([]);
  });

  it('trims the name', async () => {
    const dto = await validateDto({ ...BODY, accGroupName: '  Debtors ' }, SaveAccGroupMasterDto);

    expect(dto.accGroupName).toBe('Debtors');
  });

  // Inherited from the parent, never sent: the DTO has no door for them.
  it.each([['accGroupType'], ['accLedgerProfile'], ['accGroupNature'], ['accGroupCompanyId']])(
    'refuses %s, which the parent decides',
    async (field) => {
      await expect(
        refusedFields({ ...BODY, [field]: 'x' }, SaveAccGroupMasterDto),
      ).resolves.toEqual([field]);
    },
  );

  it.each([
    ['no name', { accGroupParentId: PARENT_ID }, 'accGroupName'],
    ['a blank name', { ...BODY, accGroupName: '   ' }, 'accGroupName'],
    ['a name over 150 characters', { ...BODY, accGroupName: 'N'.repeat(151) }, 'accGroupName'],
    ['an alias over 100 characters', { ...BODY, accGroupAlias: 'A'.repeat(101) }, 'accGroupAlias'],
    [
      'a short name over 50 characters',
      { ...BODY, accGroupShort: 'S'.repeat(51) },
      'accGroupShort',
    ],
    ['a parent that is not a uuid', { ...BODY, accGroupParentId: 'root' }, 'accGroupParentId'],
    ['a fractional sort', { ...BODY, accGroupSort: 1.5 }, 'accGroupSort'],
    ['an id that is not a uuid', { ...BODY, accGroupId: 'group-1' }, 'accGroupId'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveAccGroupMasterDto)).resolves.toEqual([field]);
  });
});
