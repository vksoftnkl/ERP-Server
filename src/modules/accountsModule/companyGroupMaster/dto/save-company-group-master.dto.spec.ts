import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveCompanyGroupMasterDto } from './save-company-group-master.dto';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46c001';
const COMPANY_A = '019c6f6c-be87-7a11-8905-36092c46c0a1';
const COMPANY_B = '019c6f6c-be87-7a11-8905-36092c46c0a2';
const BODY = { cogGroupName: 'North Region', cogCompanyIds: [COMPANY_A, COMPANY_B] };

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

const companyIdsOf = async (cogCompanyIds: unknown): Promise<string[] | undefined> =>
  (await validateDto({ ...BODY, cogCompanyIds }, SaveCompanyGroupMasterDto))?.cogCompanyIds;

describe('SaveCompanyGroupMasterDto (through the house pipe)', () => {
  it('accepts a new group naming only its name and companies', async () => {
    await expect(refusedFields(BODY, SaveCompanyGroupMasterDto)).resolves.toEqual([]);
  });

  it('accepts an update carrying its id and an active flag', async () => {
    await expect(
      refusedFields(
        { ...BODY, cogGroupId: GROUP_ID, cogIsActive: false },
        SaveCompanyGroupMasterDto,
      ),
    ).resolves.toEqual([]);
  });

  it('trims the name', async () => {
    const dto = await validateDto(
      { ...BODY, cogGroupName: '  North Region  ' },
      SaveCompanyGroupMasterDto,
    );

    expect(dto?.cogGroupName).toBe('North Region');
  });

  // The pipe's implicit conversion must not flip a real JSON false.
  it('keeps cogIsActive false when the body sends false', async () => {
    const dto = await validateDto({ ...BODY, cogIsActive: false }, SaveCompanyGroupMasterDto);

    expect(dto?.cogIsActive).toBe(false);
  });

  // A blank id reads as "no id", so the save creates rather than updates.
  it('treats a blank cogGroupId as absent', async () => {
    const dto = await validateDto({ ...BODY, cogGroupId: '  ' }, SaveCompanyGroupMasterDto);

    expect(dto?.cogGroupId).toBeUndefined();
  });

  // An empty list is a valid group with no companies yet.
  it('accepts an empty company list', async () => {
    await expect(companyIdsOf([])).resolves.toEqual([]);
  });

  describe('cogCompanyIds arrives in several shapes', () => {
    it('trims ids and drops blanks and repeats, keeping first-seen order', async () => {
      await expect(companyIdsOf([` ${COMPANY_B} `, '', COMPANY_A, COMPANY_B])).resolves.toEqual([
        COMPANY_B,
        COMPANY_A,
      ]);
    });

    it('reads a JSON array string', async () => {
      await expect(companyIdsOf(JSON.stringify([COMPANY_A, COMPANY_B]))).resolves.toEqual([
        COMPANY_A,
        COMPANY_B,
      ]);
    });

    it('reads a comma-separated string', async () => {
      await expect(companyIdsOf(`${COMPANY_A}, ${COMPANY_B},,${COMPANY_A}`)).resolves.toEqual([
        COMPANY_A,
        COMPANY_B,
      ]);
    });

    it('reads a blank string as no companies', async () => {
      await expect(companyIdsOf('   ')).resolves.toEqual([]);
    });

    it('drops entries that are not strings', async () => {
      await expect(companyIdsOf([COMPANY_A, 42, null, { id: COMPANY_B }])).resolves.toEqual([
        COMPANY_A,
      ]);
    });
  });

  it.each([
    ['no name', { cogCompanyIds: [COMPANY_A] }, 'cogGroupName'],
    ['a blank name', { ...BODY, cogGroupName: '   ' }, 'cogGroupName'],
    ['a name over 80 characters', { ...BODY, cogGroupName: 'N'.repeat(81) }, 'cogGroupName'],
    ['a company id that is not a uuid', { ...BODY, cogCompanyIds: ['company-1'] }, 'cogCompanyIds'],
    ['a cogGroupId that is not a uuid', { ...BODY, cogGroupId: 'group-1' }, 'cogGroupId'],
    ['a key the group does not have', { ...BODY, cogCompanyId: COMPANY_A }, 'cogCompanyId'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveCompanyGroupMasterDto)).resolves.toEqual([field]);
  });

  it('accepts a name of exactly 80 characters', async () => {
    await expect(
      refusedFields({ ...BODY, cogGroupName: 'N'.repeat(80) }, SaveCompanyGroupMasterDto),
    ).resolves.toEqual([]);
  });
});
