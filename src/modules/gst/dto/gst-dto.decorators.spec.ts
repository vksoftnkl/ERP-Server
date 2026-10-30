import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { GST_ENVIRONMENTS, GST_HTTP_METHODS, GST_SERVICES } from '../config/gst-config.constants';
import {
  DateOnly,
  NullableDateOnly,
  NullableUpperEnum,
  OptionalUpperEnum,
  UpperEnum,
  WriteOnlySecret,
} from './gst-dto.decorators';

class Probe {
  @UpperEnum(GST_ENVIRONMENTS)
  env!: string;

  @OptionalUpperEnum(GST_HTTP_METHODS)
  method?: string;

  @NullableUpperEnum(GST_SERVICES)
  service?: string | null;

  @DateOnly()
  from!: string;

  @NullableDateOnly()
  upto?: string | null;

  @WriteOnlySecret(10)
  secret?: string;
}

const VALID = { env: 'SANDBOX', from: '2026-04-01' };
const pipe = createHouseValidationPipe();
const parse = (plain: object) =>
  pipe.transform({ ...VALID, ...plain }, { type: 'body', metatype: Probe }) as Promise<Probe>;

/** The house refusal details of a body the pipe refuses; [] when it passes. */
async function refusals(plain: object): Promise<{ field: string; message: string }[]> {
  try {
    await parse(plain);
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { errors: { field: string; message: string }[] }).errors;
  }
}
const refusedFields = async (plain: object) => (await refusals(plain)).map((e) => e.field);

describe('gst DTO decorators', () => {
  describe('UpperEnum / OptionalUpperEnum', () => {
    it('upper-cases and trims a vocabulary value before checking it', async () => {
      await expect(parse({ env: ' sandbox ', method: 'get' })).resolves.toMatchObject({
        env: 'SANDBOX',
        method: 'GET',
      });
    });

    it('refuses a value outside the vocabulary, listing what is allowed', async () => {
      await expect(refusals({ env: 'staging' })).resolves.toEqual([
        expect.objectContaining({
          field: 'env',
          message: 'env must be one of: SANDBOX, PRODUCTION',
        }),
      ]);
    });

    it('requires the plain one and lets the optional one be left out', async () => {
      await expect(refusedFields({ env: undefined })).resolves.toEqual(['env']);
      await expect(refusedFields({})).resolves.toEqual([]);
    });
  });

  describe('NullableUpperEnum', () => {
    it.each([
      ['null', null],
      ['""', ''],
      ['blank', '   '],
    ])('reads %s as NULL — every service', async (_label, service) => {
      await expect(parse({ service })).resolves.toMatchObject({ service: null });
    });

    it('upper-cases a value and refuses one outside the vocabulary', async () => {
      await expect(parse({ service: 'gstin_verify' })).resolves.toMatchObject({
        service: 'GSTIN_VERIFY',
      });
      await expect(refusedFields({ service: 'GSTR3B' })).resolves.toEqual(['service']);
    });
  });

  describe('DateOnly / NullableDateOnly', () => {
    it('takes YYYY-MM-DD', async () => {
      await expect(parse({ from: '2026-04-01', upto: '2027-03-31' })).resolves.toMatchObject({
        from: '2026-04-01',
        upto: '2027-03-31',
      });
    });

    it.each([
      ['a day-first date', '01/04/2026'],
      ['a timestamp', '2026-04-01T00:00:00Z'],
      ['a month that does not exist', '2026-13-01'],
    ])('refuses %s', async (_label, value) => {
      await expect(refusals({ from: value, upto: value })).resolves.toEqual([
        expect.objectContaining({ field: 'from' }),
        expect.objectContaining({ field: 'upto' }),
      ]);
    });

    it('names the shape in its message', async () => {
      await expect(refusals({ from: '01/04/2026' })).resolves.toEqual([
        expect.objectContaining({ message: 'from must be a date as YYYY-MM-DD' }),
      ]);
    });

    it('requires the plain one; the nullable one takes null or "" as NULL', async () => {
      await expect(refusedFields({ from: undefined })).resolves.toEqual(['from']);
      await expect(refusedFields({ from: '' })).resolves.toEqual(['from']);
      await expect(parse({ upto: null })).resolves.toMatchObject({ upto: null });
      await expect(parse({ upto: '' })).resolves.toMatchObject({ upto: null });
    });
  });

  describe('WriteOnlySecret', () => {
    it('keeps a secret exactly as sent — a password may end in a space', async () => {
      await expect(parse({ secret: ' p@ss ' })).resolves.toMatchObject({ secret: ' p@ss ' });
    });

    it('refuses a secret over its length', async () => {
      await expect(refusedFields({ secret: 'x'.repeat(11) })).resolves.toEqual(['secret']);
      await expect(refusedFields({ secret: 'x'.repeat(10) })).resolves.toEqual([]);
    });

    it('takes a number as its text: the house pipe converts implicitly', async () => {
      await expect(parse({ secret: 12345 })).resolves.toMatchObject({ secret: '12345' });
    });
  });
});
