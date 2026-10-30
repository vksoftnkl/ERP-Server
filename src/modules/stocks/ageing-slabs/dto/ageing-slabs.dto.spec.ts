import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveAgeingSlabsDto } from './ageing-slabs.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';

const check = async (body: unknown) => {
  const dto = plainToInstance(SaveAgeingSlabsDto, body);
  return { dto, errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }) };
};

describe('SaveAgeingSlabsDto', () => {
  it('takes a ladder with an open end left out or null', async () => {
    const { errors, dto } = await check({
      companyId: COMPANY_ID,
      slabs: [
        { slabNo: 1, label: ' 0-30 ', fromDays: 0, toDays: 30 },
        { slabNo: 2, label: 'Older', fromDays: 31, toDays: null },
      ],
    });
    expect(errors).toEqual([]);
    expect(dto.slabs[0].label).toBe('0-30');
  });

  it('leaves the ladder rules to the service: a negative fromDays or slabNo 0 passes the pipe', async () => {
    // So they come back as 422 slabs.<i>.<field>, not a 400.
    const { errors } = await check({
      companyId: COMPANY_ID,
      slabs: [{ slabNo: 0, label: '', fromDays: -1 }],
    });
    expect(errors).toEqual([]);
  });

  it('refuses the wrong types and stray fields', async () => {
    const { errors } = await check({
      companyId: COMPANY_ID,
      slabs: [{ slabNo: 'one', label: 7, fromDays: 1.5, toDays: 'x', extra: true }],
    });
    const nested = errors[0]?.children?.[0]?.children?.map((e) => e.property).sort();
    expect(nested).toEqual(['extra', 'fromDays', 'label', 'slabNo', 'toDays']);
  });

  it('wants a company and an array', async () => {
    const { errors } = await check({ slabs: 'none' });
    expect(errors.map((e) => e.property).sort()).toEqual(['companyId', 'slabs']);
  });
});
