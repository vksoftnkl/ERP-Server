import { HttpException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
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

describe('GstinLookupService', () => {
  let prisma: {
    company: { findFirst: jest.Mock };
  };
  let fetchMock: jest.SpyInstance;
  let service: GstinLookupService;
  const env = { ...process.env };

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
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

  beforeEach(() => {
    delete process.env.GST_LOOKUP_SOURCE_GSTIN;
    process.env.GST_LOOKUP_ENDPOINT = 'https://gsp.example/commonapi/v1.1/search';
    process.env.GST_LOOKUP_ASP_ID = 'ASP1';
    process.env.GST_LOOKUP_ASP_PASSWORD = 'secret';
    prisma = {
      company: { findFirst: jest.fn().mockResolvedValue({ compGstinNo: '33AAAAA0000A1Z5' }) },
    };
    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new GstinLookupService(
      prisma as unknown as PrismaService,
      { getCompanyId: () => 'c1' } as unknown as RequestContextService,
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    process.env = { ...env };
  });

  it("asks the provider as the company's own GSTIN and maps the taxpayer record", async () => {
    respond(200, { data: TAXPAYER });
    const result = await service.search('33ABNPL5414F1ZU');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
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
      address: {
        building: '12, Mill Road',
        city: 'Coimbatore',
        pin: '641001',
        state: 'Tamil Nadu',
      },
    });
    expect(result.raw).toEqual(TAXPAYER);
  });

  it('is 503 naming each missing setting, or a bad endpoint, or no source GSTIN', async () => {
    delete process.env.GST_LOOKUP_ENDPOINT;
    process.env.GST_LOOKUP_ASP_PASSWORD = '';
    const unset = await failure(service.search('33ABNPL5414F1ZU'));
    expect(unset.status).toBe(503);
    expect(unset.body).toContain('GST_LOOKUP_ENDPOINT, GST_LOOKUP_ASP_PASSWORD');
    expect(unset.body).not.toContain('GST_LOOKUP_ASP_ID');

    process.env.GST_LOOKUP_ENDPOINT = 'gsp.example/search';
    process.env.GST_LOOKUP_ASP_PASSWORD = 'secret';
    const badUrl = await failure(service.search('33ABNPL5414F1ZU'));
    expect(badUrl.status).toBe(503);
    expect(badUrl.body).toContain('not a valid URL');

    process.env.GST_LOOKUP_ENDPOINT = 'https://gsp.example/commonapi/v1.1/search';
    prisma.company.findFirst.mockResolvedValue({ compGstinNo: null });
    const noSource = await failure(service.search('33ABNPL5414F1ZU'));
    expect(noSource.status).toBe(503);
    expect(noSource.body).toContain('GST_LOOKUP_SOURCE_GSTIN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is 404 when the provider has no taxpayer, 502 when it fails — never echoing the password', async () => {
    respond(200, { status_cd: '0', error: { message: 'Invalid GSTIN' }, message: 'No record' });
    const missing = await failure(service.search('33ABNPL5414F1ZU'));
    expect(missing.status).toBe(404);
    expect(missing.body).toContain('No record');

    respond(500, 'upstream down');
    const down = await failure(service.search('33ABNPL5414F1ZU'));
    expect(down.status).toBe(502);

    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const unreachable = await failure(service.search('33ABNPL5414F1ZU'));
    expect(unreachable.status).toBe(502);
    for (const body of [missing.body, down.body, unreachable.body]) {
      expect(body).not.toContain('secret');
    }
  });
});
