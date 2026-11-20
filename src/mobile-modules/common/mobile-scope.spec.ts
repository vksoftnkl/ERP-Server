import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import {
  findMobileBranch,
  requireMobileBranchOfCompany,
  resolveMobileDevice,
  type MobileReadClient,
} from './mobile-scope';

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

describe('requireMobileBranchOfCompany', () => {
  const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';

  it('answers an active, live branch of the company, checked by id and company', async () => {
    const client = clientAnswering([{ brId: BRANCH }]);
    await expect(requireMobileBranchOfCompany(client, COMPANY, BRANCH, 'soBranchId')).resolves.toBe(
      BRANCH,
    );
    const [strings, ...values] = (client.$queryRaw as jest.Mock).mock.calls[0];
    const sql = (strings as string[]).join('?');
    expect(sql).toContain('b.br_comp_id = ?::uuid');
    expect(sql).toContain('b.br_is_deleted = false');
    expect(sql).toContain('b.br_is_active = true');
    expect(values).toEqual([BRANCH, COMPANY]);
  });

  it("refuses any other id (another company's, switched off, deleted, unknown) with a 422", async () => {
    let caught: unknown = null;
    try {
      await requireMobileBranchOfCompany(clientAnswering([]), COMPANY, BRANCH, 'soBranchId');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnprocessableEntityException);
    const body = (caught as UnprocessableEntityException).getResponse() as {
      errors: { field: string; code: string }[];
    };
    expect(body.errors).toEqual([
      expect.objectContaining({ field: 'soBranchId', code: 'MOBILE_BRANCH_NOT_OF_COMPANY' }),
    ]);
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
