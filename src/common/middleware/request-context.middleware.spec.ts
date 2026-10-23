import type { Request, Response } from 'express';
import { RequestContextService } from '../request-context/request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

type RequestShape = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  remoteAddress?: string;
};

describe('RequestContextMiddleware', () => {
  const context = new RequestContextService();
  const middleware = new RequestContextMiddleware(context);

  /** What the request handler would read from the context while `next` runs. */
  const storeFor = ({ headers = {}, ip, remoteAddress }: RequestShape) => {
    let seen: Record<string, string | null> | undefined;
    const request = { headers, ip, socket: { remoteAddress } } as unknown as Request;

    middleware.use(request, {} as Response, () => {
      seen = {
        ipAddress: context.getIpAddress(),
        userId: context.getUserId(),
        userType: context.getUserType(),
        companyId: context.getCompanyId(),
        branchId: context.getBranchId(),
        deviceId: context.getDeviceId(),
      };
    });

    return seen;
  };

  it('runs next inside a fresh context', () => {
    const next = jest.fn();

    middleware.use({ headers: {}, socket: {} } as unknown as Request, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(context.getIpAddress()).toBeNull();
  });

  it('leaves the company, branch, device and user type for AccessTokenGuard to fill', () => {
    expect(storeFor({ headers: { 'x-user-id': 'u1' }, ip: '10.0.0.5' })).toEqual({
      ipAddress: '10.0.0.5',
      userId: 'u1',
      userType: null,
      companyId: null,
      branchId: null,
      deviceId: null,
    });
  });

  describe('client ip', () => {
    it('takes the first non-empty address of x-forwarded-for', () => {
      expect(
        storeFor({ headers: { 'x-forwarded-for': ' , 203.0.113.7, 10.0.0.1' }, ip: '10.0.0.1' })
          ?.ipAddress,
      ).toBe('203.0.113.7');
    });

    it('falls back to x-real-ip when x-forwarded-for is not an address', () => {
      expect(
        storeFor({ headers: { 'x-forwarded-for': 'unknown', 'x-real-ip': ' 198.51.100.2 ' } })
          ?.ipAddress,
      ).toBe('198.51.100.2');
    });

    it('falls back to request.ip, then the socket address', () => {
      expect(storeFor({ ip: '192.168.0.106' })?.ipAddress).toBe('192.168.0.106');
      expect(storeFor({ ip: 'not-an-ip', remoteAddress: '::1' })?.ipAddress).toBe('::1');
    });

    it('strips the brackets of an IPv6 literal', () => {
      expect(storeFor({ headers: { 'x-real-ip': '[2001:db8::1]' } })?.ipAddress).toBe(
        '2001:db8::1',
      );
    });

    it('ignores a header repeated into an array', () => {
      expect(
        storeFor({ headers: { 'x-forwarded-for': ['203.0.113.7'] }, ip: '10.0.0.1' })?.ipAddress,
      ).toBe('10.0.0.1');
    });

    it('is null when nothing on the request is an address', () => {
      expect(storeFor({ headers: { 'x-real-ip': '   ' }, ip: '' })?.ipAddress).toBeNull();
    });
  });

  describe('x-user-id', () => {
    it('is trimmed', () => {
      expect(storeFor({ headers: { 'x-user-id': '  u-42  ' } })?.userId).toBe('u-42');
    });

    it('is null when blank, absent or repeated', () => {
      expect(storeFor({ headers: { 'x-user-id': '   ' } })?.userId).toBeNull();
      expect(storeFor({})?.userId).toBeNull();
      expect(storeFor({ headers: { 'x-user-id': ['a', 'b'] } })?.userId).toBeNull();
    });
  });
});
