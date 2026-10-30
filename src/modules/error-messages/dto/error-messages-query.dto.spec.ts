import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ErrorMessagesQueryDto } from './error-messages-query.dto';

const parse = (plain: object) => plainToInstance(ErrorMessagesQueryDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('ErrorMessagesQueryDto', () => {
  it('lets both lang and since be left out or sent as null', () => {
    expect(erroredFields({})).toEqual([]);
    expect(erroredFields({ lang: null, since: null })).toEqual([]);
  });

  it('trims both, and turns a blank one into null', () => {
    expect(parse({ lang: ' ta ', since: '   ' })).toMatchObject({ lang: 'ta', since: null });
  });

  it('refuses a lang over 10 characters and a since over 40', () => {
    expect(erroredFields({ lang: 'x'.repeat(11), since: 'v'.repeat(41) })).toEqual([
      'lang',
      'since',
    ]);
    expect(erroredFields({ lang: 'x'.repeat(10), since: 'v'.repeat(40) })).toEqual([]);
  });
});
