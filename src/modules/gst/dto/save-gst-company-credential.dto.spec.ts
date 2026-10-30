import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { SaveGstCompanyCredentialDto } from './save-gst-company-credential.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46ea01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46ea02';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46ea03';
const VALID = {
  gccCompanyId: COMPANY_ID,
  gccGpvId: GPV_ID,
  gccEnvironment: 'SANDBOX',
  gccLoginId: 'api_user',
  gccValidFrom: '2026-04-01',
};
const pipe = createHouseValidationPipe();

const parse = (plain: object) =>
  pipe.transform(
    { ...VALID, ...plain },
    { type: 'body', metatype: SaveGstCompanyCredentialDto },
  ) as Promise<SaveGstCompanyCredentialDto>;

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

describe('SaveGstCompanyCredentialDto', () => {
  it('accepts a full branch credential, trimming the login and the IPs but never a secret', async () => {
    await expect(
      parse({
        gccBranchId: BRANCH_ID,
        gccService: 'einvoice',
        gccEnvironment: 'production',
        gccPriority: 2,
        gccLoginId: ' api_user ',
        password: ' p@ss ',
        clientId: 'cid',
        clientSecret: 'csec',
        appKey: 'k'.repeat(44),
        gccPublicKeyRef: 'nic-einv-prod.v2',
        gccWhitelistedIps: [' 203.0.113.10 ', '2001:db8::1'],
        gccValidUpto: '2027-03-31',
        gccIsActive: true,
      }),
    ).resolves.toMatchObject({
      gccService: 'EINVOICE',
      gccEnvironment: 'PRODUCTION',
      gccLoginId: 'api_user',
      password: ' p@ss ',
      gccWhitelistedIps: ['203.0.113.10', '2001:db8::1'],
    });
  });

  it('reads a null branch as the company, null IPs as none, "" service as every service', async () => {
    await expect(
      parse({ gccBranchId: null, gccWhitelistedIps: null, gccService: '' }),
    ).resolves.toMatchObject({ gccBranchId: null, gccWhitelistedIps: [], gccService: null });
  });

  it('requires the company, provider, environment, login and valid-from', async () => {
    await expect(
      refusedFields({ ...Object.fromEntries(Object.keys(VALID).map((k) => [k, undefined])) }),
    ).resolves.toEqual([
      'gccCompanyId',
      'gccGpvId',
      'gccEnvironment',
      'gccLoginId',
      'gccValidFrom',
    ]);
  });

  it.each([
    ['gccId', 'x'],
    ['gccBranchId', 'branch-1'],
    ['gccService', 'GSTR3B'],
    ['gccEnvironment', 'UAT'],
    ['gccPriority', 0],
    ['gccPriority', 10],
    ['gccLoginId', ''],
    ['gccLoginId', 'x'.repeat(201)],
    ['password', 'x'.repeat(501)],
    ['appKey', 'x'.repeat(501)],
    ['gccPublicKeyRef', '../etc/passwd'],
    ['gccPublicKeyRef', 'x'.repeat(101)],
    ['gccWhitelistedIps', ['10.0.0.300']],
    ['gccWhitelistedIps', 'not-a-list'],
    ['gccValidFrom', null],
    ['gccValidFrom', '2026/04/01'],
    ['gccValidUpto', 'tomorrow'],
    ['gccRemarks', 'x'.repeat(501)],
  ])('refuses %s = %p', async (field, value) => {
    await expect(refusedFields({ [field]: value })).resolves.toEqual([field]);
  });

  it('words the public key and IP rules', async () => {
    await expect(
      refusals({ gccPublicKeyRef: 'a/b', gccWhitelistedIps: ['localhost'] }),
    ).resolves.toEqual([
      expect.objectContaining({
        message: 'gccPublicKeyRef may hold only letters, digits, . _ -',
      }),
      expect.objectContaining({
        message: 'each of gccWhitelistedIps must be an IPv4 or IPv6 address',
      }),
    ]);
  });

  it('clears the three clearable secrets but never the password', async () => {
    await expect(parse({ clear: ['clientId', 'clientSecret', 'appKey'] })).resolves.toMatchObject({
      clear: ['clientId', 'clientSecret', 'appKey'],
    });
    await expect(refusals({ clear: ['password'] })).resolves.toEqual([
      expect.objectContaining({
        field: 'clear',
        message: 'each of clear must be one of: clientId, clientSecret, appKey',
      }),
    ]);
  });
});
