import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveCustomerGroupDto } from './save-customer-group.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a402';

const groupOf = (plain: object) =>
  plainToInstance(SaveCustomerGroupDto, { cgrName: 'Wholesale', ...plain });
const erroredFields = (plain: object): string[] =>
  validateSync(groupOf(plain)).map((error) => error.property);

describe('SaveCustomerGroupDto', () => {
  it('needs a name', () => {
    expect(
      validateSync(plainToInstance(SaveCustomerGroupDto, {})).map((error) => error.property),
    ).toEqual(['cgrName']);
  });

  it('accepts a full set of credit terms', () => {
    expect(
      erroredFields({
        cgrCompanyId: COMPANY_ID,
        cgrDiscPerc: 2.5,
        cgrDebitAllowed: true,
        cgrDebitDays: 30,
        cgrDebitLimit: 50000,
        cgrBillsLimit: 5,
        cgrCollectionDays: [1, 15],
      }),
    ).toEqual([]);
  });

  it('reads collection days sent as comma-separated text', () => {
    const group = groupOf({ cgrCollectionDays: '5,20' });

    expect(group.cgrCollectionDays).toEqual([5, 20]);
    expect(validateSync(group)).toEqual([]);
  });

  it('refuses negative day counts', () => {
    expect(erroredFields({ cgrDebitDays: -1, cgrBillsLimit: -2 }).sort()).toEqual([
      'cgrBillsLimit',
      'cgrDebitDays',
    ]);
  });

  it('refuses a fractional day count', () => {
    expect(erroredFields({ cgrDebitDays: 1.5 })).toEqual(['cgrDebitDays']);
  });

  it('refuses a company id that is not a uuid', () => {
    expect(erroredFields({ cgrCompanyId: 'acme' })).toEqual(['cgrCompanyId']);
  });

  it('refuses an alias longer than 150 characters', () => {
    expect(erroredFields({ cgrAlias: 'a'.repeat(151) })).toEqual(['cgrAlias']);
  });
});
