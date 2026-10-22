import { BadRequestException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import {
  SaveGstProviderDto,
  SaveGstProviderEndpointDto,
  SaveGstProviderErrorMapDto,
  SaveGstProviderFieldMapDto,
  SaveGstProviderServiceDto,
} from './save-gst-provider.dto';

const ID = '019c6f6c-be87-7a11-8905-36092c46e801';
const pipe = createHouseValidationPipe();

const parse = <T>(metatype: Type<T>, plain: object) =>
  pipe.transform(plain, { type: 'body', metatype }) as Promise<T>;

/** The house refusal details of a body the pipe refuses; [] when it passes. */
async function refusals(
  metatype: Type<unknown>,
  plain: object,
): Promise<{ field: string; message: string; code: string }[]> {
  try {
    await parse(metatype, plain);
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { errors: { field: string; message: string; code: string }[] })
      .errors;
  }
}
const refusedFields = async (metatype: Type<unknown>, plain: object) =>
  (await refusals(metatype, plain)).map((e) => e.field);

describe('SaveGstProviderDto', () => {
  const VALID = { gpvCode: 'NIC', gpvName: 'NIC IRP' };
  const fields = (plain: object) => refusedFields(SaveGstProviderDto, { ...VALID, ...plain });

  it('accepts a code and a name, upper-casing the code', async () => {
    await expect(
      parse(SaveGstProviderDto, { gpvCode: ' chartered_2 ', gpvName: ' Chartered ' }),
    ).resolves.toMatchObject({ gpvCode: 'CHARTERED_2', gpvName: 'Chartered' });
  });

  it.each([
    ['opens with a digit', '2NIC'],
    ['holds a hyphen', 'NIC-X'],
    ['is over 20 characters', 'N'.repeat(21)],
  ])('refuses a code that %s', async (_label, gpvCode) => {
    await expect(fields({ gpvCode })).resolves.toEqual(['gpvCode']);
  });

  it('words the code rule', async () => {
    await expect(refusals(SaveGstProviderDto, { ...VALID, gpvCode: '2NIC' })).resolves.toEqual([
      expect.objectContaining({
        message: 'gpvCode must start with a letter and hold only A-Z, 0-9 and _',
      }),
    ]);
  });

  it('requires both the code and the name', async () => {
    await expect(refusedFields(SaveGstProviderDto, {})).resolves.toEqual(['gpvCode', 'gpvName']);
    await expect(fields({ gpvName: '   ' })).resolves.toEqual(['gpvName']);
  });

  it.each([
    ['gpvTimeoutMs', 999],
    ['gpvTimeoutMs', 600001],
    ['gpvMaxRetries', -1],
    ['gpvMaxRetries', 11],
    ['gpvRateLimitPerMin', 0],
    ['gpvRateLimitPerMin', 32768],
    ['gpvSupportEmail', 'not-an-email'],
    ['gpvSupportPhone', '9'.repeat(21)],
    ['gpvId', 'NIC'],
  ])('refuses %s = %p', async (field, value) => {
    await expect(fields({ [field]: value })).resolves.toEqual([field]);
  });

  it('takes null for the nullable fields and the bounds of the ranges', async () => {
    await expect(
      fields({
        gpvPortalUrl: null,
        gpvSupportEmail: null,
        gpvRateLimitPerMin: null,
        gpvRemarks: null,
        gpvTimeoutMs: 1000,
        gpvMaxRetries: 10,
      }),
    ).resolves.toEqual([]);
  });

  it('refuses a field it does not know', async () => {
    await expect(fields({ gpvKeyVersion: 2 })).resolves.toEqual(['gpvKeyVersion']);
  });
});

describe('SaveGstProviderServiceDto', () => {
  const VALID = {
    gpsGpvId: ID,
    gpsService: 'EINVOICE',
    gpsEnvironment: 'SANDBOX',
    gpsBaseUrl: 'https://einv-apisandbox.nic.in',
    gpsAuthScheme: 'NIC_SEK',
  };
  const fields = (plain: object) =>
    refusedFields(SaveGstProviderServiceDto, { ...VALID, ...plain });

  it('drops trailing slashes from the base and fallback URLs and upper-cases the vocabulary', async () => {
    await expect(
      parse(SaveGstProviderServiceDto, {
        ...VALID,
        gpsService: 'ewaybill',
        gpsEnvironment: 'production',
        gpsBaseUrl: ' https://ewb.nic.in// ',
        gpsFallbackUrls: ['https://ewb2.nic.in/'],
        gpsPayloadEncryption: 'aes_sek',
      }),
    ).resolves.toMatchObject({
      gpsService: 'EWAYBILL',
      gpsEnvironment: 'PRODUCTION',
      gpsBaseUrl: 'https://ewb.nic.in',
      gpsFallbackUrls: ['https://ewb2.nic.in'],
      gpsPayloadEncryption: 'AES_SEK',
    });
  });

  it('reads null fallback URLs as none', async () => {
    await expect(
      parse(SaveGstProviderServiceDto, { ...VALID, gpsFallbackUrls: null }),
    ).resolves.toMatchObject({ gpsFallbackUrls: [] });
  });

  it.each([
    ['gpsGpvId', undefined],
    ['gpsService', 'GSTR3B'],
    ['gpsEnvironment', 'STAGING'],
    ['gpsBaseUrl', 'ftp://ewb.nic.in'],
    ['gpsBaseUrl', 'https://'],
    ['gpsFallbackUrls', ['ewb2.nic.in']],
    ['gpsAuthScheme', 'KERBEROS'],
    ['gpsPayloadEncryption', 'PGP'],
    ['gpsTokenTtlMinutes', 0],
    ['gpsRefreshMarginMinutes', -1],
    ['gpsTimeoutMs', 999],
    ['gpsMaxRetries', 11],
  ])('refuses %s = %p', async (field, value) => {
    await expect(fields({ [field]: value })).resolves.toEqual([field]);
  });

  it('words the URL rule', async () => {
    await expect(
      refusals(SaveGstProviderServiceDto, { ...VALID, gpsBaseUrl: 'einv.nic.in' }),
    ).resolves.toEqual([
      expect.objectContaining({ message: 'gpsBaseUrl must be http(s)://host, no trailing slash' }),
    ]);
  });

  it('takes null for the service’s own timeout and retries', async () => {
    await expect(fields({ gpsTimeoutMs: null, gpsMaxRetries: null })).resolves.toEqual([]);
  });
});

describe('SaveGstProviderEndpointDto', () => {
  const VALID = { gpeGpsId: ID, gpeAction: 'AUTH', gpePathTemplate: '/eivital/v1.04/auth' };
  const fields = (plain: object) =>
    refusedFields(SaveGstProviderEndpointDto, { ...VALID, ...plain });

  it('accepts a full AUTH endpoint, upper-casing the action and method', async () => {
    await expect(
      parse(SaveGstProviderEndpointDto, {
        ...VALID,
        gpeAction: 'auth',
        gpeHttpMethod: 'post',
        gpeHeaders: { Gstin: '{gstin}', client_id: '{clientId}' },
        gpeRedactPaths: ['$.Password', '$.AppKey'],
        gpeResponseRootPath: '$.Data',
        gpeSuccessPath: '$.Status',
        gpeSuccessValue: '1',
        gpeErrorCodePath: '$.ErrorDetails[0].ErrorCode',
        gpeErrorMessagePath: '$.ErrorDetails[0].ErrorMessage',
        gpeIsIdempotent: false,
      }),
    ).resolves.toMatchObject({ gpeAction: 'AUTH', gpeHttpMethod: 'POST' });
  });

  it.each([
    ['gpeAction', 'LOGIN'],
    ['gpeHttpMethod', 'FETCH'],
    ['gpePathTemplate', 'eivital/v1.04/auth'],
    ['gpeHeaders', 'Gstin: x'],
    ['gpeRedactPaths', ['Password']],
    ['gpeResponseRootPath', 'Data'],
    ['gpeSuccessPath', 'Status'],
    ['gpeSuccessValue', 'x'.repeat(21)],
    ['gpeErrorCodePath', 'ErrorCode'],
    ['gpeErrorMessagePath', 'ErrorMessage'],
    ['gpeRequestWrapper', 'x'.repeat(31)],
    ['gpeContentType', 'x'.repeat(61)],
    ['gpeTimeoutMs', 600001],
    ['gpeMaxRetries', -1],
  ])('refuses %s = %p', async (field, value) => {
    await expect(fields({ [field]: value })).resolves.toEqual([field]);
  });

  it('words the path rules', async () => {
    await expect(
      refusals(SaveGstProviderEndpointDto, {
        ...VALID,
        gpePathTemplate: 'auth',
        gpeRedactPaths: ['Password'],
      }),
    ).resolves.toEqual([
      expect.objectContaining({ message: 'gpePathTemplate must start with /' }),
      expect.objectContaining({ message: 'each of gpeRedactPaths must start with $' }),
    ]);
  });

  it('takes null for every nullable path, header and limit', async () => {
    await expect(
      fields({
        gpeHeaders: null,
        gpeRedactPaths: null,
        gpeResponseRootPath: null,
        gpeSuccessPath: null,
        gpeSuccessValue: null,
        gpeErrorCodePath: null,
        gpeErrorMessagePath: null,
        gpeQueryTemplate: null,
        gpeRequestWrapper: null,
        gpeTimeoutMs: null,
        gpeMaxRetries: null,
      }),
    ).resolves.toEqual([]);
  });
});

describe('SaveGstProviderFieldMapDto', () => {
  const VALID = {
    gfmGpeId: ID,
    gfmDirection: 'RESPONSE',
    gfmOurField: 'auth_token',
    gfmTheirPath: '$.AuthToken',
  };
  const fields = (plain: object) =>
    refusedFields(SaveGstProviderFieldMapDto, { ...VALID, ...plain });

  it('accepts a field map, upper-casing its vocabulary', async () => {
    await expect(
      parse(SaveGstProviderFieldMapDto, {
        ...VALID,
        gfmDirection: 'response',
        gfmDataType: 'datetime',
        gfmTransform: 'datetime_mask',
        gfmFormatMask: 'dd/MM/yyyy hh:mm:ss tt',
        gfmTargetColumn: 'gde_irn',
        gfmSortOrder: -5,
      }),
    ).resolves.toMatchObject({
      gfmDirection: 'RESPONSE',
      gfmDataType: 'DATETIME',
      gfmTransform: 'DATETIME_MASK',
    });
  });

  it.each([
    ['gfmDirection', 'BOTH'],
    ['gfmOurField', '  '],
    ['gfmOurField', 'x'.repeat(61)],
    ['gfmTheirPath', 'AuthToken'],
    ['gfmDataType', 'UUID'],
    ['gfmTransform', 'REVERSE'],
    ['gfmFormatMask', 'x'.repeat(41)],
    ['gfmTargetColumn', 'GdeIrn'],
    ['gfmTargetColumn', '1col'],
    ['gfmSortOrder', 32768],
  ])('refuses %s = %p', async (field, value) => {
    await expect(fields({ [field]: value })).resolves.toEqual([field]);
  });
});

describe('SaveGstProviderErrorMapDto', () => {
  const VALID = { gemGpvId: ID, gemTheirCode: '2150', gemOurCode: 'DUPLICATE_IRN' };
  const fields = (plain: object) =>
    refusedFields(SaveGstProviderErrorMapDto, { ...VALID, ...plain });

  it('accepts an error map, upper-casing its vocabulary and reading "" service as every service', async () => {
    await expect(
      parse(SaveGstProviderErrorMapDto, {
        ...VALID,
        gemService: '',
        gemOurCode: 'duplicate_irn',
        gemTreatAs: 'success',
        gemExtractPath: '$.ErrorDetails[0].InfoDtls.Irn',
        gemCanonicalField: 'irn',
        gemRecoveryAction: 'fetch_by_doc',
        gemSeverity: 'warn',
      }),
    ).resolves.toMatchObject({
      gemService: null,
      gemOurCode: 'DUPLICATE_IRN',
      gemTreatAs: 'SUCCESS',
      gemRecoveryAction: 'FETCH_BY_DOC',
      gemSeverity: 'WARN',
    });
  });

  it.each([
    ['gemService', 'GSTR3B'],
    ['gemTheirCode', ''],
    ['gemTheirCode', 'x'.repeat(51)],
    ['gemOurCode', 'SOMETHING_ELSE'],
    ['gemTreatAs', 'IGNORE'],
    ['gemExtractPath', 'Irn'],
    ['gemCanonicalField', 'x'.repeat(61)],
    ['gemRetryAfterSeconds', -1],
    ['gemRecoveryAction', 'RETRY'],
    ['gemSeverity', 'FATAL'],
    ['gemMessage', 'x'.repeat(501)],
  ])('refuses %s = %p', async (field, value) => {
    await expect(fields({ [field]: value })).resolves.toEqual([field]);
  });
});
