import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PriceBucketsQueryDto } from './price-buckets-query.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';

const erroredFields = (plain: object): string[] =>
  validateSync(plainToInstance(PriceBucketsQueryDto, plain)).map((error) => error.property);

describe('PriceBucketsQueryDto', () => {
  it('accepts a company and a branch', () => {
    expect(erroredFields({ companyId: COMPANY_ID, branchId: BRANCH_ID })).toEqual([]);
  });

  // A bucket's prices only mean anything relative to a company and the branch reading them.
  it('requires both', () => {
    expect(erroredFields({})).toEqual(['companyId', 'branchId']);
  });

  it('refuses ids that are not uuids', () => {
    expect(erroredFields({ companyId: 'acme', branchId: 'main' })).toEqual([
      'companyId',
      'branchId',
    ]);
  });
});
