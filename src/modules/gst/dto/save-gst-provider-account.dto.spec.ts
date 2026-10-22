import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { SaveGstProviderAccountDto } from './save-gst-provider-account.dto';

const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e901';
const VALID = { gpaGpvId: GPV_ID, gpaEnvironment: 'SANDBOX', gpaAccountRef: 'ACC-7' };
const pipe = createHouseValidationPipe();

const parse = (plain: object) =>
  pipe.transform(
    { ...VALID, ...plain },
    { type: 'body', metatype: SaveGstProviderAccountDto },
  ) as Promise<SaveGstProviderAccountDto>;

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

describe('SaveGstProviderAccountDto', () => {
  it('accepts an account with its secrets, untrimmed, and upper-cases the vocabulary', async () => {
    await expect(
      parse({
        gpaEnvironment: 'production',
        gpaService: 'gstin_verify',
        clientId: 'asp-1',
        clientSecret: ' pass ',
        apiKey: 'k'.repeat(2000),
        clear: [],
        gpaValidFrom: '2026-04-01',
        gpaValidUpto: null,
        gpaRemarks: null,
        gpaIsActive: false,
      }),
    ).resolves.toMatchObject({
      gpaEnvironment: 'PRODUCTION',
      gpaService: 'GSTIN_VERIFY',
      clientSecret: ' pass ',
      gpaValidUpto: null,
    });
  });

  it('leaves the secrets it was not sent undefined, so the service keeps them', async () => {
    const dto = await parse({});

    expect(dto.clientId).toBeUndefined();
    expect(dto.clientSecret).toBeUndefined();
    expect(dto.apiKey).toBeUndefined();
    expect(dto.clear).toBeUndefined();
  });

  it('requires the provider, the environment and the account ref', async () => {
    await expect(
      refusedFields({ gpaGpvId: undefined, gpaEnvironment: undefined, gpaAccountRef: undefined }),
    ).resolves.toEqual(['gpaGpvId', 'gpaEnvironment', 'gpaAccountRef']);
    await expect(refusedFields({ gpaAccountRef: '  ' })).resolves.toEqual(['gpaAccountRef']);
  });

  it.each([
    ['gpaId', 'not-a-uuid'],
    ['gpaEnvironment', 'STAGING'],
    ['gpaService', 'GSTR3B'],
    ['gpaAccountRef', 'x'.repeat(101)],
    ['clientId', 'x'.repeat(501)],
    ['clientSecret', 'x'.repeat(501)],
    ['apiKey', 'x'.repeat(2001)],
    ['clear', 'apiKey'],
    ['gpaValidFrom', '01/04/2026'],
    ['gpaValidUpto', '2027-3-31'],
    ['gpaRemarks', 'x'.repeat(501)],
  ])('refuses %s = %p', async (field, value) => {
    await expect(refusedFields({ [field]: value })).resolves.toEqual([field]);
  });

  it('clears only the account’s own secrets', async () => {
    await expect(parse({ clear: ['clientId', 'clientSecret', 'apiKey'] })).resolves.toMatchObject({
      clear: ['clientId', 'clientSecret', 'apiKey'],
    });
    await expect(refusals({ clear: ['password'] })).resolves.toEqual([
      expect.objectContaining({
        field: 'clear',
        message: 'each of clear must be one of: clientId, clientSecret, apiKey',
      }),
    ]);
  });
});
