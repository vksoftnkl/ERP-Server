import {
  GstCompanyCredential,
  GstProvider,
  GstProviderAccount,
  GstProviderEndpoint,
  GstProviderErrorMap,
  GstProviderFieldMap,
  GstProviderService,
  Prisma,
} from '@prisma/client';
import {
  istToday,
  toAccountPayload,
  toCredentialPayload,
  toEndpointPayload,
  toErrorMapPayload,
  toFieldMapPayload,
  toProviderAuditRecord,
  toProviderPayload,
  toServicePayload,
  type GstCredentialContext,
} from './gst-config.mappers';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T06:00:00.000Z');
const CIPHER = 'gcm:v1:aXY=:dGFn:Ym9keQ==';

const STAMP = {
  createdOn: '2026-10-01T04:30:00.000Z',
  createdBy: USER_ID,
  modifiedOn: null,
  modifiedBy: null,
};

const providerRow = (overrides: Partial<GstProvider> = {}): GstProvider => ({
  gpvId: 'gpv-1',
  gpvCode: 'NIC',
  gpvName: 'NIC IRP',
  gpvPortalUrl: 'https://einvoice1.gst.gov.in',
  gpvSupportEmail: null,
  gpvSupportPhone: null,
  gpvTimeoutMs: 30000,
  gpvMaxRetries: 2,
  gpvRateLimitPerMin: null,
  gpvRemarks: null,
  gpvIsActive: true,
  gpvIsDeleted: false,
  gpvSyncDate: null,
  gpvCreatedOn: CREATED_ON,
  gpvCreatedBy: USER_ID,
  gpvModifiedOn: null,
  gpvModifiedBy: null,
  ...overrides,
});

const serviceRow = (overrides: Partial<GstProviderService> = {}): GstProviderService => ({
  gpsId: 'gps-1',
  gpsGpvId: 'gpv-1',
  gpsService: 'EINVOICE',
  gpsEnvironment: 'SANDBOX',
  gpsBaseUrl: 'https://einv-apisandbox.nic.in',
  gpsFallbackUrls: [],
  gpsAuthScheme: 'NIC_SEK',
  gpsTokenTtlMinutes: 360,
  gpsRefreshMarginMinutes: 15,
  gpsPayloadEncryption: 'AES_SEK',
  gpsTimeoutMs: null,
  gpsMaxRetries: null,
  gpsRemarks: null,
  gpsIsActive: true,
  gpsIsDeleted: false,
  gpsSyncDate: null,
  gpsCreatedOn: CREATED_ON,
  gpsCreatedBy: USER_ID,
  gpsModifiedOn: null,
  gpsModifiedBy: null,
  ...overrides,
});

const endpointRow = (overrides: Partial<GstProviderEndpoint> = {}): GstProviderEndpoint => ({
  gpeId: 'gpe-1',
  gpeGpsId: 'gps-1',
  gpeAction: 'AUTH',
  gpeHttpMethod: 'POST',
  gpePathTemplate: '/eivital/v1.04/auth',
  gpeQueryTemplate: null,
  gpeContentType: 'application/json',
  gpeHeaders: { Gstin: '{gstin}' },
  gpeRequestWrapper: 'Data',
  gpeRedactPaths: ['$.Password'],
  gpeResponseRootPath: '$.Data',
  gpeSuccessPath: '$.Status',
  gpeSuccessValue: '1',
  gpeErrorCodePath: null,
  gpeErrorMessagePath: null,
  gpeTimeoutMs: null,
  gpeMaxRetries: null,
  gpeIsIdempotent: false,
  gpeRemarks: null,
  gpeIsActive: true,
  gpeIsDeleted: false,
  gpeSyncDate: null,
  gpeCreatedOn: CREATED_ON,
  gpeCreatedBy: USER_ID,
  gpeModifiedOn: null,
  gpeModifiedBy: null,
  ...overrides,
});

const accountRow = (overrides: Partial<GstProviderAccount> = {}): GstProviderAccount => ({
  gpaId: 'gpa-1',
  gpaGpvId: 'gpv-1',
  gpaEnvironment: 'SANDBOX',
  gpaService: null,
  gpaAccountRef: 'ACC-7',
  gpaClientIdEnc: CIPHER,
  gpaClientSecretEnc: null,
  gpaApiKeyEnc: null,
  gpaKeyVersion: 1,
  gpaValidFrom: new Date('2026-04-01T00:00:00.000Z'),
  gpaValidUpto: null,
  gpaCreditBalance: new Prisma.Decimal('1250.50'),
  gpaBalanceCheckedOn: null,
  gpaLastVerifiedOn: MODIFIED_ON,
  gpaRemarks: null,
  gpaIsActive: true,
  gpaIsDeleted: false,
  gpaSyncDate: null,
  gpaCreatedOn: CREATED_ON,
  gpaCreatedBy: USER_ID,
  gpaModifiedOn: null,
  gpaModifiedBy: null,
  ...overrides,
});

const credentialRow = (overrides: Partial<GstCompanyCredential> = {}): GstCompanyCredential => ({
  gccId: 'gcc-1',
  gccCompanyId: 'comp-1',
  gccBranchId: null,
  gccGpvId: 'gpv-1',
  gccService: 'EINVOICE',
  gccEnvironment: 'SANDBOX',
  gccPriority: 1,
  gccLoginId: 'api_user',
  gccPasswordEnc: CIPHER,
  gccClientIdEnc: null,
  gccClientSecretEnc: null,
  gccAppKeyEnc: CIPHER,
  gccPublicKeyRef: 'nic-einv-sandbox',
  gccKeyVersion: 1,
  gccWhitelistedIps: ['203.0.113.10'],
  gccValidFrom: new Date('2026-04-01T00:00:00.000Z'),
  gccValidUpto: null,
  gccPasswordChangedOn: null,
  gccLastVerifiedOn: null,
  gccLastErrorMessage: null,
  gccRemarks: null,
  gccIsActive: true,
  gccIsDeleted: false,
  gccSyncDate: null,
  gccCreatedOn: CREATED_ON,
  gccCreatedBy: USER_ID,
  gccModifiedOn: null,
  gccModifiedBy: null,
  ...overrides,
});

const CONTEXT: GstCredentialContext = {
  compName: 'Zeta Traders',
  compGstinNo: '33AAACZ0000A1Z5',
  brName: null,
  brGstinNo: null,
  gpvCode: 'NIC',
  gpvName: 'NIC IRP',
};

describe('gst-config mappers', () => {
  it('maps a provider header with its audit stamp as ISO text', () => {
    const row = providerRow({ gpvModifiedOn: MODIFIED_ON, gpvModifiedBy: 'editor' });

    expect(toProviderAuditRecord(row)).toEqual({
      gpvId: 'gpv-1',
      gpvCode: 'NIC',
      gpvName: 'NIC IRP',
      gpvPortalUrl: 'https://einvoice1.gst.gov.in',
      gpvSupportEmail: null,
      gpvSupportPhone: null,
      gpvTimeoutMs: 30000,
      gpvMaxRetries: 2,
      gpvRateLimitPerMin: null,
      gpvRemarks: null,
      gpvIsActive: true,
      gpvIsDeleted: false,
      createdOn: '2026-10-01T04:30:00.000Z',
      createdBy: USER_ID,
      modifiedOn: '2026-10-02T06:00:00.000Z',
      modifiedBy: 'editor',
    });
  });

  it('adds the services, accounts and counts to the provider payload', () => {
    const extra = {
      services: [],
      accounts: [],
      endpointCount: 4,
      errorMapCount: 9,
      credentialCount: 2,
    };

    expect(toProviderPayload(providerRow(), extra)).toEqual({
      ...toProviderAuditRecord(providerRow()),
      ...extra,
    });
  });

  it('maps a service with the endpoint count it is given', () => {
    expect(toServicePayload(serviceRow({ gpsFallbackUrls: ['https://b.nic.in'] }), 3)).toEqual({
      gpsId: 'gps-1',
      gpsGpvId: 'gpv-1',
      gpsService: 'EINVOICE',
      gpsEnvironment: 'SANDBOX',
      gpsBaseUrl: 'https://einv-apisandbox.nic.in',
      gpsFallbackUrls: ['https://b.nic.in'],
      gpsAuthScheme: 'NIC_SEK',
      gpsTokenTtlMinutes: 360,
      gpsRefreshMarginMinutes: 15,
      gpsPayloadEncryption: 'AES_SEK',
      gpsTimeoutMs: null,
      gpsMaxRetries: null,
      gpsRemarks: null,
      gpsIsActive: true,
      gpsIsDeleted: false,
      endpointCount: 3,
      ...STAMP,
    });
  });

  describe('toEndpointPayload', () => {
    const service = { gpsGpvId: 'gpv-1', gpsService: 'EINVOICE', gpsEnvironment: 'SANDBOX' };

    it('carries the service’s provider, service and environment beside its own columns', () => {
      expect(toEndpointPayload(endpointRow(), service)).toMatchObject({
        gpeId: 'gpe-1',
        gpeGpsId: 'gps-1',
        gpvId: 'gpv-1',
        gpsService: 'EINVOICE',
        gpsEnvironment: 'SANDBOX',
        gpeAction: 'AUTH',
        gpeHeaders: { Gstin: '{gstin}' },
        gpeRedactPaths: ['$.Password'],
        gpeSuccessPath: '$.Status',
        gpeSuccessValue: '1',
        ...STAMP,
      });
    });

    it.each([
      ['an array', ['x']],
      ['a string', 'x'],
      ['null', null],
    ])('reads headers stored as %s as null', (_label, headers) => {
      expect(
        toEndpointPayload(endpointRow({ gpeHeaders: headers as Prisma.JsonValue }), service)
          .gpeHeaders,
      ).toBeNull();
    });

    it('reads redact paths that are not a list as null', () => {
      expect(
        toEndpointPayload(endpointRow({ gpeRedactPaths: { a: 1 } }), service).gpeRedactPaths,
      ).toBeNull();
      expect(
        toEndpointPayload(endpointRow({ gpeRedactPaths: null }), service).gpeRedactPaths,
      ).toBeNull();
    });
  });

  it('maps a field map', () => {
    const row: GstProviderFieldMap = {
      gfmId: 'gfm-1',
      gfmGpeId: 'gpe-1',
      gfmDirection: 'RESPONSE',
      gfmOurField: 'auth_token',
      gfmTheirPath: '$.AuthToken',
      gfmDataType: 'TEXT',
      gfmTransform: 'NONE',
      gfmFormatMask: null,
      gfmIsRequired: true,
      gfmDefaultValue: null,
      gfmTargetColumn: null,
      gfmSortOrder: 1,
      gfmIsDeleted: false,
      gfmSyncDate: null,
      gfmCreatedOn: CREATED_ON,
      gfmCreatedBy: USER_ID,
      gfmModifiedOn: null,
      gfmModifiedBy: null,
    };
    const { gfmSyncDate: _sync, gfmCreatedOn: _c, gfmCreatedBy: _cb, ...columns } = row;
    const { gfmModifiedOn: _m, gfmModifiedBy: _mb, ...rest } = columns;

    expect(toFieldMapPayload(row)).toEqual({ ...rest, ...STAMP });
  });

  it('maps an error map', () => {
    const row: GstProviderErrorMap = {
      gemId: 'gem-1',
      gemGpvId: 'gpv-1',
      gemService: null,
      gemTheirCode: '2150',
      gemOurCode: 'DUPLICATE_IRN',
      gemMessage: 'Duplicate IRN',
      gemTreatAs: 'SUCCESS',
      gemExtractPath: '$.ErrorDetails[0].InfoDtls.Irn',
      gemCanonicalField: 'irn',
      gemIsRetryable: false,
      gemRetryAfterSeconds: null,
      gemShouldReauth: false,
      gemRecoveryAction: 'FETCH_BY_DOC',
      gemSeverity: 'WARN',
      gemIsDeleted: false,
      gemSyncDate: null,
      gemCreatedOn: CREATED_ON,
      gemCreatedBy: USER_ID,
      gemModifiedOn: null,
      gemModifiedBy: null,
    };
    const { gemSyncDate: _sync, gemCreatedOn: _c, gemCreatedBy: _cb, ...columns } = row;
    const { gemModifiedOn: _m, gemModifiedBy: _mb, ...rest } = columns;

    expect(toErrorMapPayload(row)).toEqual({ ...rest, ...STAMP });
  });

  describe('toAccountPayload (notes 79 §3: never a secret)', () => {
    it('says which secrets are set, never what they are', () => {
      const payload = toAccountPayload(accountRow(), 'NIC');

      expect(payload).toEqual({
        gpaId: 'gpa-1',
        gpaGpvId: 'gpv-1',
        gpvCode: 'NIC',
        gpaEnvironment: 'SANDBOX',
        gpaService: null,
        gpaAccountRef: 'ACC-7',
        hasClientId: true,
        hasClientSecret: false,
        hasApiKey: false,
        keyVersion: 1,
        gpaValidFrom: '2026-04-01',
        gpaValidUpto: null,
        gpaCreditBalance: 1250.5,
        gpaBalanceCheckedOn: null,
        gpaLastVerifiedOn: '2026-10-02T06:00:00.000Z',
        gpaRemarks: null,
        gpaIsActive: true,
        gpaIsDeleted: false,
        ...STAMP,
      });
      expect(JSON.stringify(payload)).not.toContain('gcm:');
    });

    it('counts an empty ciphertext as set: only NULL means absent', () => {
      const payload = toAccountPayload(
        accountRow({ gpaClientIdEnc: null, gpaClientSecretEnc: '', gpaApiKeyEnc: CIPHER }),
        'NIC',
      );

      expect(payload).toMatchObject({ hasClientId: false, hasClientSecret: true, hasApiKey: true });
    });
  });

  describe('toCredentialPayload (notes 79 §3: never a secret)', () => {
    const TODAY = '2026-10-21';

    it('shows the company GSTIN and the has* flags, never a secret', () => {
      const payload = toCredentialPayload(credentialRow(), CONTEXT, TODAY);

      expect(payload).toMatchObject({
        gccId: 'gcc-1',
        compName: 'Zeta Traders',
        brName: null,
        gstin: '33AAACZ0000A1Z5',
        gpvCode: 'NIC',
        gpvName: 'NIC IRP',
        isPrimary: true,
        hasPassword: true,
        hasClientId: false,
        hasClientSecret: false,
        hasAppKey: true,
        keyVersion: 1,
        gccWhitelistedIps: ['203.0.113.10'],
        gccValidFrom: '2026-04-01',
        gccValidUpto: null,
        isExpired: false,
        ...STAMP,
      });
      expect(JSON.stringify(payload)).not.toContain('gcm:');
    });

    it('shows the branch’s own GSTIN over the company’s', () => {
      const payload = toCredentialPayload(
        credentialRow({ gccBranchId: 'br-1' }),
        { ...CONTEXT, brName: 'Madurai', brGstinNo: '33AAACZ0000A2Z4' },
        TODAY,
      );

      expect(payload).toMatchObject({
        gccBranchId: 'br-1',
        brName: 'Madurai',
        gstin: '33AAACZ0000A2Z4',
      });
    });

    it('marks a failover login as not primary and an empty password as not set', () => {
      expect(
        toCredentialPayload(credentialRow({ gccPriority: 2, gccPasswordEnc: '' }), CONTEXT, TODAY),
      ).toMatchObject({ isPrimary: false, hasPassword: false });
    });

    it.each([
      ['yesterday', '2026-10-20', true],
      ['today', '2026-10-21', false],
      ['tomorrow', '2026-10-22', false],
    ])('a login valid up to %s (%s) is expired: %s', (_label, upto, expired) => {
      const payload = toCredentialPayload(
        credentialRow({ gccValidUpto: new Date(`${upto}T00:00:00.000Z`) }),
        CONTEXT,
        TODAY,
      );

      expect(payload.gccValidUpto).toBe(upto);
      expect(payload.isExpired).toBe(expired);
    });
  });

  describe('istToday', () => {
    it('turns over at midnight IST, not UTC', () => {
      expect(istToday(new Date('2026-10-20T18:29:59.999Z'))).toBe('2026-10-20');
      expect(istToday(new Date('2026-10-20T18:30:00.000Z'))).toBe('2026-10-21');
    });

    it('defaults to now', () => {
      expect(istToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
