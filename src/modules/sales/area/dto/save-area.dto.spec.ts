import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveAreaDto } from './save-area.dto';

const CITY_ID = '019c6f6c-be87-7a11-8905-36092c46a303';

const areaOf = (plain: object) =>
  plainToInstance(SaveAreaDto, { armName: 'Kakkanad', armCityId: CITY_ID, ...plain });
const erroredFields = (plain: object): string[] =>
  validateSync(areaOf(plain)).map((error) => error.property);

describe('SaveAreaDto', () => {
  it('needs a name and a city', () => {
    expect(
      validateSync(plainToInstance(SaveAreaDto, {}))
        .map((error) => error.property)
        .sort(),
    ).toEqual(['armCityId', 'armName']);
  });

  it('refuses a city id that is not a uuid', () => {
    expect(erroredFields({ armCityId: 'kochi' })).toEqual(['armCityId']);
  });

  it('reads collection days sent as text', () => {
    const area = areaOf({ armCollectionDays: '1, 15' });

    expect(area.armCollectionDays).toEqual([1, 15]);
    expect(validateSync(area)).toEqual([]);
  });

  it('reads an empty collection-days value as no days', () => {
    expect(areaOf({ armCollectionDays: '' }).armCollectionDays).toEqual([]);
    expect(areaOf({ armCollectionDays: null }).armCollectionDays).toEqual([]);
  });

  it('refuses a collection day that is not a whole number', () => {
    expect(erroredFields({ armCollectionDays: [1, 2.5] })).toEqual(['armCollectionDays']);
  });

  it('reads a distance sent as text and refuses a negative one', () => {
    expect(areaOf({ armDistanceKm: '12' }).armDistanceKm).toBe(12);
    expect(erroredFields({ armDistanceKm: -3 })).toEqual(['armDistanceKm']);
  });

  it('lets the distance be cleared with null', () => {
    const area = areaOf({ armDistanceKm: null });

    expect(area.armDistanceKm).toBeNull();
    expect(validateSync(area)).toEqual([]);
  });
});
