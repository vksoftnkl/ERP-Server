import { HttpException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { GetPartyAdjustableCreditsDto } from './get-party-adjustable-credits.dto';

const QUERY = {
  companyId: '019c6f6c-be87-7a11-8905-36092c46e001',
  partyId: '019c6f6c-be87-7a11-8905-36092c46e002',
};

const pipe = createHouseValidationPipe();
const transform = (value: unknown) =>
  pipe.transform(value, {
    type: 'query',
    metatype: GetPartyAdjustableCreditsDto,
  }) as Promise<GetPartyAdjustableCreditsDto>;

/** The fields the house pipe refused; [] when it let the query through. */
async function refusedFields(value: unknown): Promise<string[]> {
  try {
    await transform(value);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('GetPartyAdjustableCreditsDto (through the house pipe)', () => {
  it('accepts the party and company alone, leaving type unset', async () => {
    const dto = await transform(QUERY);

    expect(dto.type).toBeUndefined();
  });

  it.each([
    ['cr', 'CR'],
    [' dr ', 'DR'],
    ['CR', 'CR'],
  ])('reads type %p as %s', async (type, side) => {
    await expect(transform({ ...QUERY, type })).resolves.toMatchObject({ type: side });
  });

  it.each([
    ['no party', { companyId: QUERY.companyId }, 'partyId'],
    ['a party that is not a uuid', { ...QUERY, partyId: 'party-1' }, 'partyId'],
    ['no company', { partyId: QUERY.partyId }, 'companyId'],
    ['a company that is not a uuid', { ...QUERY, companyId: 'company-1' }, 'companyId'],
    ['a side other than CR or DR', { ...QUERY, type: 'BOTH' }, 'type'],
    // There is no year filter: credits are never carried forward.
    ['an accounting year', { ...QUERY, accYear: '2026-2027' }, 'accYear'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query)).resolves.toEqual([field]);
  });
});
