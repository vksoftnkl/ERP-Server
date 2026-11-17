import { ForbiddenException } from '@nestjs/common';
import { findMobileBranch, resolveMobileDevice, type MobileReadClient } from './mobile-scope';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';

/** A client whose one raw read answers `rows`. */
function clientAnswering(rows: unknown[]): MobileReadClient {
  return { $queryRaw: jest.fn().mockResolvedValue(rows) };
}

async function refusalCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (!(error instanceof ForbiddenException)) throw error;
    return (error.getResponse() as { errors: { code: string }[] }).errors[0].code;
  }
}

describe('findMobileBranch', () => {
  const b = (brId: string, preferred = false, isDefault = false) => ({
    brId,
    preferred,
    isDefault,
  });

  it("takes the phone's own branch when it is one of the company's", async () => {
    const client = clientAnswering([b('own', true), b('default', false, true)]);
    await expect(findMobileBranch(client, COMPANY, 'own')).resolves.toBe('own');
  });

  it("else the company's default branch", async () => {
    const client = clientAnswering([b('a'), b('default', false, true)]);
    await expect(findMobileBranch(client, COMPANY, 'elsewhere')).resolves.toBe('default');
  });

  it('else its only branch; several with no default, or none, = null', async () => {
    await expect(findMobileBranch(clientAnswering([b('only')]), COMPANY, null)).resolves.toBe(
      'only',
    );
    await expect(
      findMobileBranch(clientAnswering([b('a'), b('b')]), COMPANY, null),
    ).resolves.toBeNull();
    await expect(findMobileBranch(clientAnswering([]), COMPANY, null)).resolves.toBeNull();
  });
});

describe('resolveMobileDevice', () => {
  const device = (over: Record<string, unknown> = {}) => ({
    devId: 'dev',
    devCode: 'D9',
    devCompanyId: COMPANY,
    devBranchId: 'branch',
    devIsActive: true,
    devIsBlocked: false,
    devBlockReason: null,
    ...over,
  });

  it('answers a registered, active, unblocked phone', async () => {
    await expect(resolveMobileDevice(clientAnswering([device()]), 'uid')).resolves.toEqual({
      devId: 'dev',
      devCode: 'D9',
      devCompanyId: COMPANY,
      devBranchId: 'branch',
    });
  });

  it('refuses an unknown, blocked or switched-off phone with a 403', async () => {
    await expect(refusalCode(resolveMobileDevice(clientAnswering([]), 'uid'))).resolves.toBe(
      'MOBILE_DEVICE_NOT_REGISTERED',
    );
    await expect(
      refusalCode(resolveMobileDevice(clientAnswering([device({ devIsBlocked: true })]), 'uid')),
    ).resolves.toBe('MOBILE_DEVICE_BLOCKED');
    await expect(
      refusalCode(resolveMobileDevice(clientAnswering([device({ devIsActive: false })]), 'uid')),
    ).resolves.toBe('MOBILE_DEVICE_INACTIVE');
  });
});
