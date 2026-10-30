import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GetStockTrackPresetsQueryDto } from './get-stock-track-presets-query.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const SPT_ID = '01000000-0000-7000-8000-0000000000e1';

const parse = (plain: object) => plainToInstance(GetStockTrackPresetsQueryDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('GetStockTrackPresetsQueryDto', () => {
  it('lets every filter be left out', () => {
    expect(erroredFields({})).toEqual([]);
  });

  it('accepts a company, an id and a code together', () => {
    expect(erroredFields({ company_id: COMPANY_ID, spt_id: SPT_ID, spt_code: 'PHARMA' })).toEqual(
      [],
    );
  });

  it('trims the code, and drops a blank one', () => {
    expect(parse({ spt_code: ' PHARMA ' }).spt_code).toBe('PHARMA');
    expect(parse({ spt_code: '   ' }).spt_code).toBeUndefined();
  });

  it.each([
    ['a company id that is not a uuid', { company_id: 'company-1' }, 'company_id'],
    ['a preset id that is not a uuid', { spt_id: 'pharma' }, 'spt_id'],
    ['a code over 30 characters', { spt_code: 'C'.repeat(31) }, 'spt_code'],
  ])('refuses %s', (_label, plain, field) => {
    expect(erroredFields(plain)).toEqual([field]);
  });
});
