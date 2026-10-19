import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveCustomerDto } from './save-customer.dto';

const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e104';

const REQUIRED = {
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusPriceLevelId: 1,
};

const toDto = (plain: object) => plainToInstance(SaveCustomerDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(toDto(plain)).map((error) => error.property);

describe('SaveCustomerDto', () => {
  it('accepts a plain create', () => {
    expect(
      erroredFields({
        ...REQUIRED,
        cusName: 'Ravi',
        cusStateName: 'Tamil Nadu',
        cusStateCode: '33',
      }),
    ).toEqual([]);
  });

  it('requires the state name and code on a create that makes its own ledger', () => {
    expect(erroredFields({ ...REQUIRED, cusName: 'Ravi' })).toEqual([
      'cusStateName',
      'cusStateCode',
    ]);
  });

  it('lets a link create leave the state out, since it defaults from the ledger', () => {
    expect(erroredFields({ ...REQUIRED, cusLinkLedId: LEDGER_ID })).toEqual([]);
  });

  it('still checks a state code a link create does send', () => {
    expect(erroredFields({ ...REQUIRED, cusLinkLedId: LEDGER_ID, cusStateCode: 'TNX' })).toEqual([
      'cusStateCode',
    ]);
  });

  it('requires the area, group and price level', () => {
    expect(
      erroredFields({ cusName: 'Ravi', cusStateName: 'Tamil Nadu', cusStateCode: '33' }),
    ).toEqual(['cusPriceLevelId', 'cusAreaId', 'cusGroupId']);
  });

  it('reads collection days sent as a comma list', () => {
    const dto = toDto({
      ...REQUIRED,
      cusStateName: 'Tamil Nadu',
      cusStateCode: '33',
      cusCollectionDays: '1, 4',
    });

    expect(dto.cusCollectionDays).toEqual([1, 4]);
    expect(validateSync(dto)).toEqual([]);
  });

  it('refuses a collection day that is not a whole number', () => {
    expect(
      erroredFields({
        ...REQUIRED,
        cusStateName: 'Tamil Nadu',
        cusStateCode: '33',
        cusCollectionDays: [1, 2.5],
      }),
    ).toEqual(['cusCollectionDays']);
  });

  it('refuses a cusLinkLedId that is not a uuid', () => {
    expect(erroredFields({ ...REQUIRED, cusLinkLedId: 'ledger-1' })).toContain('cusLinkLedId');
  });
});
