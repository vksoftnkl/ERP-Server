import { RequestContextService } from './request-context.service';

const emptyStore = () => ({
  ipAddress: null,
  userId: null,
  userType: null,
  companyId: null,
  branchId: null,
  deviceId: null,
});

describe('RequestContextService', () => {
  const service = new RequestContextService();

  it('reads null for everything outside a request', () => {
    expect(service.getIpAddress()).toBeNull();
    expect(service.getUserId()).toBeNull();
    expect(service.getUserType()).toBeNull();
    expect(service.getCompanyId()).toBeNull();
    expect(service.getBranchId()).toBeNull();
    expect(service.getDeviceId()).toBeNull();
  });

  it('ignores a set outside a request instead of throwing', () => {
    service.setUserId('u1');
    service.setUserType('ADMIN');
    service.setCompanyId('c1');
    service.setBranchId('b1');
    service.setDeviceId('d1');

    expect(service.getUserId()).toBeNull();
    expect(service.getCompanyId()).toBeNull();
  });

  it("returns the callback's result", () => {
    expect(service.run(emptyStore(), () => 42)).toBe(42);
  });

  it('keeps what the guard sets for the rest of the request', () => {
    service.run({ ...emptyStore(), ipAddress: '10.0.0.5' }, () => {
      service.setUserId('u1');
      service.setUserType('ADMIN');
      service.setCompanyId('c1');
      service.setBranchId('b1');
      service.setDeviceId('d1');

      expect(service.getIpAddress()).toBe('10.0.0.5');
      expect(service.getUserId()).toBe('u1');
      expect(service.getUserType()).toBe('ADMIN');
      expect(service.getCompanyId()).toBe('c1');
      expect(service.getBranchId()).toBe('b1');
      expect(service.getDeviceId()).toBe('d1');
    });
  });

  it('keeps two concurrent requests apart across awaits', async () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
    const request = (companyId: string) =>
      service.run(emptyStore(), async () => {
        service.setCompanyId(companyId);
        await tick();
        return service.getCompanyId();
      });

    await expect(Promise.all([request('c1'), request('c2')])).resolves.toEqual(['c1', 'c2']);
  });

  it('forgets the request once run returns', () => {
    service.run(emptyStore(), () => service.setUserId('u1'));

    expect(service.getUserId()).toBeNull();
  });
});
