import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OptionalStockBucket } from './sales-dto.decorators';

class LineDto {
  @OptionalStockBucket()
  bucket?: string;
}

const lineOf = (plain: object) => plainToInstance(LineDto, plain);
const erroredFields = (plain: object) =>
  validateSync(lineOf(plain)).map((error) => error.property);

describe('OptionalStockBucket', () => {
  it('lets the bucket be left out, which means SALEABLE', () => {
    expect(erroredFields({})).toEqual([]);
  });

  it('trims and upper-cases what it is sent', () => {
    const line = lineOf({ bucket: ' damaged ' });

    expect(line.bucket).toBe('DAMAGED');
    expect(validateSync(line)).toEqual([]);
  });

  it('refuses an explicit null, which would override the NOT NULL default', () => {
    expect(erroredFields({ bucket: null })).toEqual(['bucket']);
  });

  it('refuses a bucket outside the five the CHECK constraint allows, naming them', () => {
    const [error] = validateSync(lineOf({ bucket: 'RESERVED' }));

    expect(error.property).toBe('bucket');
    expect(Object.values(error.constraints ?? {})[0]).toBe(
      'bucket must be one of SALEABLE, DAMAGED, QUARANTINE, EXPIRED, SAMPLE — omit it for SALEABLE',
    );
  });
});
