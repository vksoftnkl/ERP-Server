import { HttpException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { GstHttpError } from '../../gst/client/gst-http.client';
import { GstCryptoService } from '../../gst/config/gst-crypto.service';
import { GstinLookupService } from './gstin-lookup.service';

const TAXPAYER = {
  gstin: '33ABNPL5414F1ZU',
  lgnm: 'ACME FOODS PRIVATE LIMITED',
  tradeNam: 'ACME FOODS',
  sts: 'Active',
  dty: 'Regular',
  rgdt: '01/07/2017',
  pradr: {
    addr: {
      bno: '12',
      bnm: 'Mill Road',
      st: 'Main St',
      loc: 'Coimbatore',
      dst: 'Coimbatore',
      stcd: 'Tamil Nadu',
      pncd: '641001',
    },
  },
};

const PROVIDER = {
  gpvId: 'gpv-1',
  gpvCode: 'CHARTERED',
  gpvTimeoutMs: 45000,
  gpvIsActive: true,
  gpvIsDeleted: false,
};
const endpointRow = (over: Record<string, unknown> = {}) => ({
  gpeId: 'gpe-1',
  gpeAction: 'VERIFY_GSTIN',
  gpeHttpMethod: 'GET',
  gpePathTemplate: '/commonapi/v1.1/search',
  gpeQueryTemplate:
    '?aspid={aspId}&password={aspPassword}&Action=TP&Gstin={gstin}&SearchGstin={searchGstin}',
  gpeHeaders: null,
  gpeRedactPaths: null,
  gpeResponseRootPath: null,
  gpeSuccessPath: null,
  gpeSuccessValue: null,
  gpeErrorCodePath: '$.error.error_cd',
  gpeErrorMessagePath: '$.error.message',
  gpeTimeoutMs: 10000,
  gpeIsActive: true,
  gpeIsDeleted: false,
  ...over,
});
const serviceRow = (over: Record<string, unknown> = {}) => ({
  gpsId: 'gps-prod',
  gpsGpvId: 'gpv-1',
  gpsService: 'GSTIN_VERIFY',
  gpsEnvironment: 'PRODUCTION',
  gpsBaseUrl: 'https://gsp.example',
  gpsTimeoutMs: null,
  gpsCreatedOn: new Date('2026-09-21T00:00:00Z'),
  gpsIsActive: true,
  gpsIsDeleted: false,
  provider: PROVIDER,
  endpoints: [endpointRow()],
  ...over,
});
const ACCOUNT = {
  gpaId: 'gpa-1',
  gpaClientIdEnc: 'enc:ASP1',
  gpaClientSecretEnc: 'enc:secret',
  gpaApiKeyEnc: null,
  gpaIsActive: true,
  gpaIsDeleted: false,
};

describe('GstinLookupService', () => {
  let prisma: {
    company: { findFirst: jest.Mock };
    gstProviderService: { findMany: jest.Mock };
    gstProviderAccount: { findFirst: jest.Mock };
    gstProviderErrorMap: { findMany: jest.Mock };
    gstApiLog: { create: jest.Mock };
  };
  let http: { send: jest.Mock };
  let companyId: string | null;
  let service: GstinLookupService;

  const respond = (status: number, body: unknown) =>
    http.send.mockResolvedValue({
      status,
      text: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const failure = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return {
        status: (error as HttpException).getStatus(),
        body: JSON.stringify((error as HttpException).getResponse()),
      };
    }
    throw new Error('expected a failure');
  };
  const sent = (call = 0) =>
    http.send.mock.calls[call][0] as {
      method: string;
      url: string;
      headers: Record<string, string>;
      timeoutMs: number;
    };
  const loggedRow = (call = 0) =>
    (prisma.gstApiLog.create.mock.calls[call][0] as { data: Record<string, unknown> }).data;

  beforeEach(() => {
    prisma = {
      company: { findFirst: jest.fn().mockResolvedValue({ compGstinNo: '33AAAAA0000A1Z5' }) },
      gstProviderService: { findMany: jest.fn().mockResolvedValue([serviceRow()]) },
      gstProviderAccount: { findFirst: jest.fn().mockResolvedValue(ACCOUNT) },
      gstProviderErrorMap: { findMany: jest.fn().mockResolvedValue([]) },
      gstApiLog: { create: jest.fn().mockResolvedValue({}) },
    };
    http = { send: jest.fn() };
    companyId = 'c1';
    service = new GstinLookupService(
      prisma as unknown as PrismaService,
      {
        getCompanyId: () => companyId,
        getBranchId: () => 'b1',
        getUserId: () => 'u1',
      } as unknown as RequestContextService,
      { decrypt: (v: string) => v.replace(/^enc:/, '') } as unknown as GstCryptoService,
      http,
    );
  });

  // ── The rows decide where and as whom (notes 87) ─────────────────────────
  it("calls what the VERIFY_GSTIN row says, as the company's GSTIN, and maps the taxpayer", async () => {
    respond(200, { data: TAXPAYER });
    const result = await service.search('33ABNPL5414F1ZU');

    const call = sent();
    expect(call.method).toBe('GET');
    expect(call.timeoutMs).toBe(10000);
    const url = new URL(call.url);
    expect(url.origin + url.pathname).toBe('https://gsp.example/commonapi/v1.1/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      aspid: 'ASP1',
      password: 'secret',
      Action: 'TP',
      Gstin: '33AAAAA0000A1Z5',
      SearchGstin: '33ABNPL5414F1ZU',
    });
    expect(result).toMatchObject({
      legalName: 'ACME FOODS PRIVATE LIMITED',
      tradeName: 'ACME FOODS',
      status: 'Active',
      gstRegType: 'REGULAR',
      stateCode: '33',
      panNo: 'ABNPL5414F',
      address: { building: '12, Mill Road', city: 'Coimbatore', pin: '641001' },
    });
    expect(result.raw).toEqual(TAXPAYER);
  });

  it('reads inactive rows too, only to name them; an active account is tried first', async () => {
    respond(200, TAXPAYER);
    await service.search('33ABNPL5414F1ZU');
    expect(prisma.gstProviderService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          gpsService: 'GSTIN_VERIFY',
          gpsIsDeleted: false,
          provider: { gpvIsDeleted: false },
        },
        include: expect.objectContaining({
          endpoints: expect.objectContaining({
            where: { gpeAction: 'VERIFY_GSTIN', gpeIsDeleted: false },
          }),
        }),
      }),
    );
    expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gpaGpvId: 'gpv-1',
          gpaEnvironment: 'PRODUCTION',
          gpaIsActive: true,
          OR: [{ gpaService: 'GSTIN_VERIFY' }, { gpaService: null }],
        }),
      }),
    );
    // The network door gets the same rows to check again.
    expect((http.send.mock.calls[0][0] as { route: { provider: unknown } }).route.provider).toBe(
      PROVIDER,
    );
  });

  it('prefers PRODUCTION, and skips a chain with no endpoint or no account', async () => {
    respond(200, TAXPAYER);
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow({
        gpsId: 'gps-sb',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: 'https://sandbox.example',
      }),
      serviceRow(),
    ]);
    await service.search('33ABNPL5414F1ZU');
    expect(new URL(sent(0).url).host).toBe('gsp.example');

    // PRODUCTION without an endpoint, so SANDBOX it is.
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow({ endpoints: [] }),
      serviceRow({
        gpsId: 'gps-sb',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: 'https://sandbox.example',
      }),
    ]);
    await service.search('33ABNPL5414F1ZU');
    expect(new URL(sent(1).url).host).toBe('sandbox.example');

    // PRODUCTION with only an inactive account, so SANDBOX again.
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow(),
      serviceRow({
        gpsId: 'gps-sb',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: 'https://sandbox.example',
      }),
    ]);
    prisma.gstProviderAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ACCOUNT, gpaIsActive: false });
    await service.search('33ABNPL5414F1ZU');
    expect(new URL(sent(2).url).host).toBe('sandbox.example');

    // PRODUCTION switched off at the provider, the other provider's SANDBOX on.
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow({ provider: { ...PROVIDER, gpvIsActive: false } }),
      serviceRow({
        gpsId: 'gps-nic',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: 'https://nic.example',
        provider: { ...PROVIDER, gpvId: 'gpv-2', gpvCode: 'NIC' },
      }),
    ]);
    await service.search('33ABNPL5414F1ZU');
    expect(new URL(sent(3).url).host).toBe('nic.example');
  });

  it.each([
    [
      'the provider',
      { provider: { ...PROVIDER, gpvIsActive: false } },
      null,
      'GST provider CHARTERED is inactive',
    ],
    ['the service', { gpsIsActive: false }, null, 'GSTIN_VERIFY · PRODUCTION service is inactive'],
    [
      'the endpoint',
      { endpoints: [endpointRow({ gpeIsActive: false })] },
      null,
      'VERIFY_GSTIN endpoint of GSTIN_VERIFY · PRODUCTION is inactive',
    ],
    [
      'a missing endpoint',
      { endpoints: [] },
      null,
      'GSTIN_VERIFY · PRODUCTION has no VERIFY_GSTIN endpoint',
    ],
    [
      'the account',
      {},
      { ...ACCOUNT, gpaIsActive: false },
      'CHARTERED PRODUCTION provider account is inactive',
    ],
    ['a missing account', {}, 'none', 'CHARTERED has no PRODUCTION provider account'],
  ])(
    'is 503 "switched off" naming %s when it is off — and calls and logs nothing (notes 88)',
    async (_what, over, account, message) => {
      prisma.gstProviderService.findMany.mockResolvedValue([serviceRow(over)]);
      if (account === 'none') {
        prisma.gstProviderAccount.findFirst.mockResolvedValue(null);
      } else if (account) {
        prisma.gstProviderAccount.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(account);
      }
      const off = await failure(service.search('33ABNPL5414F1ZU'));
      expect(off.status).toBe(503);
      expect(off.body).toContain('GSTIN search is switched off');
      expect(off.body).toContain(message);
      expect(off.body).toContain('GST_SWITCHED_OFF');
      expect(http.send).not.toHaveBeenCalled();
      expect(prisma.gstApiLog.create).not.toHaveBeenCalled();
    },
  );

  it('is 503 when no GSTIN_VERIFY service is set up at all', async () => {
    prisma.gstProviderService.findMany.mockResolvedValue([]);
    const none = await failure(service.search('33ABNPL5414F1ZU'));
    expect(none.status).toBe(503);
    expect(none.body).toContain('No GSTIN_VERIFY service is set up');
    expect(http.send).not.toHaveBeenCalled();
  });

  it('is 503 naming the secret the account lacks, a bad base URL, or a company with no GSTIN', async () => {
    prisma.gstProviderAccount.findFirst.mockResolvedValue({ ...ACCOUNT, gpaClientSecretEnc: null });
    const noSecret = await failure(service.search('33ABNPL5414F1ZU'));
    expect(noSecret.status).toBe(503);
    expect(noSecret.body).toContain(
      "{aspPassword} — set clientSecret (the ASP password) on CHARTERED's PRODUCTION provider account",
    );

    prisma.gstProviderAccount.findFirst.mockResolvedValue(ACCOUNT);
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow({ gpsBaseUrl: 'gsp.example' }),
    ]);
    const badUrl = await failure(service.search('33ABNPL5414F1ZU'));
    expect(badUrl.status).toBe(503);
    expect(badUrl.body).toContain('is not a valid URL');
    expect(badUrl.body).not.toContain('secret');

    prisma.gstProviderService.findMany.mockResolvedValue([serviceRow()]);
    prisma.company.findFirst.mockResolvedValue({ compGstinNo: null });
    const noSource = await failure(service.search('33ABNPL5414F1ZU'));
    expect(noSource.status).toBe(503);
    expect(noSource.body).toContain('The company has no GSTIN to search as');

    expect(http.send).not.toHaveBeenCalled();
  });

  it('sends header templates filled, and honours the success path', async () => {
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow({
        endpoints: [
          endpointRow({
            gpeQueryTemplate: '?gstin={searchGstin}',
            gpeHeaders: { 'asp-id': '{aspId}', 'asp-secret': '{aspPassword}' },
            gpeSuccessPath: '$.status_cd',
            gpeSuccessValue: '1',
          }),
        ],
      }),
    ]);
    respond(200, { status_cd: '1', data: TAXPAYER });
    await service.search('33ABNPL5414F1ZU');
    expect(sent().headers).toMatchObject({ 'asp-id': 'ASP1', 'asp-secret': 'secret' });
    expect(loggedRow().galRequestHeaders).toMatchObject({ 'asp-id': '***', 'asp-secret': '***' });

    respond(200, { status_cd: '0', error: { error_cd: 'GSP032', message: 'Timeout' } });
    const refused = await failure(service.search('33ABNPL5414F1ZU'));
    expect(refused.status).toBe(502);
    expect(refused.body).toContain('[GSP032] Timeout');
  });

  // ── Notes 85, kept ───────────────────────────────────────────────────────
  it("passes TaxPro's nested refusal through as [code] message, and logs it redacted", async () => {
    respond(401, {
      status_cd: '0',
      error: { error_cd: 'GSP020', message: 'Invalid AspID, no matching ASP found.' },
    });
    prisma.gstProviderErrorMap.findMany.mockResolvedValue([
      { gemService: null, gemOurCode: 'AUTH_FAILED' },
    ]);
    const refused = await failure(service.search('33ABNPL5414F1ZU'));
    expect(refused.status).toBe(502);
    expect(refused.body).toContain('[GSP020] Invalid AspID, no matching ASP found.');
    expect(refused.body).not.toContain('secret');

    const row = loggedRow();
    expect(row).toMatchObject({
      galCompanyId: 'c1',
      galBranchId: 'b1',
      galGpvId: 'gpv-1',
      galService: 'GSTIN_VERIFY',
      galAction: 'VERIFY_GSTIN',
      galEnvironment: 'PRODUCTION',
      galHttpStatus: 401,
      galProviderCode: 'GSP020',
      galOurCode: 'AUTH_FAILED',
      galIsSuccess: false,
      galMessage: '[GSP020] Invalid AspID, no matching ASP found.',
      galCreatedBy: 'u1',
    });
    expect(row.galAccYear).toMatch(/^\d{4}-\d{4}$/);
    const loggedUrl = new URL(row.galRequestUrl as string);
    expect(loggedUrl.searchParams.get('aspid')).toBe('***');
    expect(loggedUrl.searchParams.get('password')).toBe('***');
    expect(loggedUrl.searchParams.get('SearchGstin')).toBe('33ABNPL5414F1ZU');
    expect(JSON.stringify(row)).not.toContain('secret');
    expect(JSON.stringify(row)).not.toContain('ASP1');
  });

  it("reads NIC's ErrorDetails[0] when the row's error paths find nothing, and a bare code still says something", async () => {
    respond(400, {
      Status: 0,
      ErrorDetails: [{ ErrorCode: 3028, ErrorMessage: 'GSTIN is not present' }],
    });
    const nic = await failure(service.search('33ABNPL5414F1ZU'));
    expect(nic.body).toContain('[3028] GSTIN is not present');
    expect(loggedRow()).toMatchObject({ galProviderCode: '3028' });

    respond(400, { status_cd: '0', error: { error_cd: 'GEN5001' } });
    const bare = await failure(service.search('33ABNPL5414F1ZU'));
    expect(bare.body).toContain('[GEN5001] The GST service answered HTTP 400');
  });

  it('logs a success, an unreachable provider and a not-found, each as one row', async () => {
    prisma.gstProviderService.findMany.mockResolvedValue([
      serviceRow({ endpoints: [endpointRow({ gpeRedactPaths: ['$.data.pradr'] })] }),
    ]);
    respond(200, { data: TAXPAYER });
    await service.search('33ABNPL5414F1ZU');
    expect(loggedRow(0)).toMatchObject({
      galIsSuccess: true,
      galHttpStatus: 200,
      galProviderCode: null,
      galMessage: 'Found ACME FOODS PRIVATE LIMITED',
      galResponsePayload: { data: { ...TAXPAYER, pradr: '***' } },
    });

    http.send.mockRejectedValue(
      new GstHttpError('NETWORK', 'Could not reach gsp.example: ECONNREFUSED'),
    );
    const unreachable = await failure(service.search('33ABNPL5414F1ZU'));
    expect(unreachable.status).toBe(502);
    expect(loggedRow(1)).toMatchObject({
      galIsSuccess: false,
      galHttpStatus: null,
      galMessage: 'Unable to reach the GST service: Could not reach gsp.example: ECONNREFUSED',
    });

    respond(200, { message: 'No record' });
    const missing = await failure(service.search('33ABNPL5414F1ZU'));
    expect(missing.status).toBe(404);
    expect(missing.body).toContain('No record');
    expect(loggedRow(2)).toMatchObject({ galIsSuccess: false, galMessage: 'No record' });
    expect(prisma.gstApiLog.create).toHaveBeenCalledTimes(3);
  });

  it('a log that cannot be written never fails the search', async () => {
    prisma.gstApiLog.create.mockRejectedValue(new Error('no partition of relation "gst_api_log"'));
    respond(200, { data: TAXPAYER });
    await expect(service.search('33ABNPL5414F1ZU')).resolves.toMatchObject({
      legalName: 'ACME FOODS PRIVATE LIMITED',
    });
  });
});
