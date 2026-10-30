import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GetItemGstUnitQueryDto } from './get-item-gst-unit-query.dto';

const parse = (plain: object) => plainToInstance(GetItemGstUnitQueryDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('GetItemGstUnitQueryDto', () => {
  it('lets search be left out', () => {
    expect(erroredFields({})).toEqual([]);
  });

  it('trims search, and drops a blank or null one', () => {
    expect(parse({ search: ' nos ' }).search).toBe('nos');
    expect(parse({ search: '   ' }).search).toBeUndefined();
    expect(parse({ search: null }).search).toBeUndefined();
  });

  it('refuses a search over 200 characters', () => {
    expect(erroredFields({ search: 'x'.repeat(201) })).toEqual(['search']);
    expect(erroredFields({ search: 'x'.repeat(200) })).toEqual([]);
  });
});
