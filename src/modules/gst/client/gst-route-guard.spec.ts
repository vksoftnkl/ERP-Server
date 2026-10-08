import { HttpException } from '@nestjs/common';
import { GstHttpClient } from './gst-http.client';
import { assertGstRouteActive, gstRouteRefusal, type GstRoute } from './gst-route-guard';

const on = (over: Partial<GstRoute> = {}): GstRoute => ({
  provider: { gpvCode: 'CHARTERED', gpvIsActive: true, gpvIsDeleted: false },
  service: {
    gpsService: 'EINVOICE',
    gpsEnvironment: 'SANDBOX',
    gpsIsActive: true,
    gpsIsDeleted: false,
  },
  action: 'AUTH',
  endpoint: {
    gpeIsActive: true,
    gpeIsDeleted: false,
    gpePathTemplate: '/eivital/dec/v1.04/auth',
    gpeQueryTemplate: null,
    gpeHeaders: { aspid: '{aspId}', password: '{aspPassword}', Gstin: '{gstin}' },
  },
  account: { gpaIsActive: true, gpaIsDeleted: false },
  credential: {
    gccIsActive: true,
    gccIsDeleted: false,
    gccClientIdEnc: null,
    gccClientSecretEnc: null,
  },
  ...over,
});

describe('gst-route-guard (notes 88)', () => {
  it('lets a route through when every row is on', () => {
    expect(gstRouteRefusal(on())).toBeNull();
  });

  it('names the FIRST row that is off: provider, service, endpoint, account, credential', () => {
    const allOff = on({
      provider: { gpvCode: 'CHARTERED', gpvIsActive: false, gpvIsDeleted: false },
      service: {
        gpsService: 'EINVOICE',
        gpsEnvironment: 'SANDBOX',
        gpsIsActive: false,
        gpsIsDeleted: false,
      },
      account: { gpaIsActive: false, gpaIsDeleted: false },
    });
    expect(gstRouteRefusal(allOff)).toBe('GST provider CHARTERED is inactive');
    expect(
      gstRouteRefusal({
        ...allOff,
        provider: { gpvCode: 'CHARTERED', gpvIsActive: true, gpvIsDeleted: false },
      }),
    ).toBe('EINVOICE · SANDBOX service is inactive');
    expect(
      gstRouteRefusal(
        on({
          endpoint: { ...on().endpoint!, gpeIsActive: false },
          account: { gpaIsActive: false, gpaIsDeleted: false },
        }),
      ),
    ).toBe('AUTH endpoint of EINVOICE · SANDBOX is inactive');
    expect(gstRouteRefusal(on({ account: { gpaIsActive: false, gpaIsDeleted: false } }))).toBe(
      'CHARTERED SANDBOX provider account is inactive',
    );
    expect(gstRouteRefusal(on({ credential: { ...on().credential!, gccIsActive: false } }))).toBe(
      'The GST credential is inactive',
    );
  });

  it('tells deleted and missing rows apart from inactive ones', () => {
    expect(
      gstRouteRefusal(on({ provider: { gpvCode: 'NIC', gpvIsActive: true, gpvIsDeleted: true } })),
    ).toBe('GST provider NIC is deleted');
    expect(gstRouteRefusal(on({ endpoint: null }))).toBe('EINVOICE · SANDBOX has no AUTH endpoint');
    expect(gstRouteRefusal(on({ account: null }))).toBe(
      'CHARTERED has no SANDBOX provider account',
    );
    expect(gstRouteRefusal(on({ credential: { ...on().credential!, gccIsDeleted: true } }))).toBe(
      'The GST credential is deleted',
    );
  });

  it('needs an account only for a value only an account holds', () => {
    const noAspHeaders = on({
      endpoint: { ...on().endpoint!, gpeHeaders: { Gstin: '{gstin}', user_name: '{loginId}' } },
      account: null,
    });
    expect(gstRouteRefusal(noAspHeaders)).toBeNull();

    // {clientId}/{clientSecret}: the credential's own pair spares the account.
    const clientPair = on({
      endpoint: {
        ...on().endpoint!,
        gpeHeaders: { client_id: '{clientId}', client_secret: '{clientSecret}' },
      },
      account: null,
    });
    expect(gstRouteRefusal(clientPair)).toBe('CHARTERED has no SANDBOX provider account');
    expect(
      gstRouteRefusal({
        ...clientPair,
        credential: { ...on().credential!, gccClientIdEnc: 'enc', gccClientSecretEnc: 'enc' },
      }),
    ).toBeNull();

    // A placeholder in the query template counts as much as one in a header.
    expect(
      gstRouteRefusal(
        on({
          endpoint: { ...on().endpoint!, gpeHeaders: null, gpeQueryTemplate: '?aspid={aspId}' },
          account: null,
        }),
      ),
    ).toBe('CHARTERED has no SANDBOX provider account');
  });

  it('checks the provider alone when no service is given', () => {
    expect(gstRouteRefusal({ provider: on().provider })).toBeNull();
    expect(
      gstRouteRefusal({
        provider: { gpvCode: 'CHARTERED', gpvIsActive: false, gpvIsDeleted: false },
      }),
    ).toBe('GST provider CHARTERED is inactive');
  });

  it('refuses as a 503 GST_SWITCHED_OFF under the caller’s title and field', () => {
    const off = on({ provider: { gpvCode: 'CHARTERED', gpvIsActive: false, gpvIsDeleted: false } });
    let thrown: unknown;
    try {
      assertGstRouteActive(off, { field: 'gccId' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(503);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      message: 'GST service is switched off',
      errors: [
        { field: 'gccId', message: 'GST provider CHARTERED is inactive', code: 'GST_SWITCHED_OFF' },
      ],
    });
    expect(() => assertGstRouteActive(on(), { field: 'gccId' })).not.toThrow();
  });

  it('the network door refuses a switched-off route before any I/O', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    try {
      const off = on({ service: { ...on().service!, gpsIsActive: false } });
      await expect(
        new GstHttpClient().send({
          method: 'GET',
          url: 'https://gsp.example/auth',
          headers: {},
          timeoutMs: 1000,
          route: off,
        }),
      ).rejects.toMatchObject({ status: 503 });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });
});
