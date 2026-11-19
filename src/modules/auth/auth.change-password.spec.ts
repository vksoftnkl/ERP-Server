import { HttpException, Logger } from '@nestjs/common';
import { hashSecret, verifySecret } from '../../common/utils/secret-hash.utils';
import { AuthService, MIN_NEW_PASSWORD_LENGTH } from './auth.service';
import { AuthErrorCode } from './types/auth-error-codes';

/**
 * POST /auth/change-password (review list 11-19, task 1): self only, the
 * current password checked with the login's own verifier, U7 (4 characters),
 * not the same password, must-change cleared, an audit row with no secret in it.
 */
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f201';
const OTHER_ID = '019c6f6c-be87-7a11-8905-36092c46f202';
const CURRENT = 'OldPass1';
const NEW = 'NewPass22';
const CHANGED_BEFORE = new Date('2026-10-01T04:30:00.000Z');

async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

describe('AuthService.changePassword', () => {
  let storedHash: string;
  let prisma: {
    userMaster: { findFirst: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let context: { getUserId: jest.Mock; getIpAddress: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let service: AuthService;
  let warn: jest.SpyInstance;

  beforeAll(async () => {
    storedHash = await hashSecret(CURRENT);
  });

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = {
      userMaster: {
        findFirst: jest.fn().mockResolvedValue({
          usrId: USER_ID,
          usrLoginName: 'cashier1',
          usrDisplayName: 'Cashier One',
          usrPasswordHash: storedHash,
          usrPasswordChangedOn: CHANGED_BEFORE,
          usrMustChangePassword: true,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    context = {
      getUserId: jest.fn().mockReturnValue(USER_ID),
      getIpAddress: jest.fn().mockReturnValue('127.0.0.1'),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      {} as never,
      {} as never,
      prisma as never,
      context as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
    );
  });

  afterEach(() => warn.mockRestore());

  const change = (currentPassword = CURRENT, newPassword = NEW) =>
    service.changePassword({ currentPassword, newPassword });
  const written = () =>
    prisma.userMaster.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };

  it('changes the password of the token user, clears must-change and answers three keys', async () => {
    const result = await change();

    expect(prisma.userMaster.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usrId: USER_ID, usrIsDeleted: false, usrIsActive: true, usrIsLocked: false },
      }),
    );
    const { where, data } = written();
    expect(where).toEqual({ usrId: USER_ID, usrIsDeleted: false, usrPasswordHash: storedHash });
    expect(data).toMatchObject({
      usrPasswordChangedOn: expect.any(Date) as Date,
      usrMustChangePassword: false,
      usrModifiedOn: expect.any(Date) as Date,
      usrModifiedBy: USER_ID,
    });
    expect(await verifySecret(NEW, data.usrPasswordHash as string)).toBe(true);
    expect(await verifySecret(CURRENT, data.usrPasswordHash as string)).toBe(false);
    expect(result).toEqual({
      usrId: USER_ID,
      usrPasswordChangedOn: (data.usrPasswordChangedOn as Date).toISOString(),
      usrMustChangePassword: false,
    });
  });

  it('stores the new password exactly as sent, as /auth/login reads it (no trim)', async () => {
    await change(CURRENT, '  spaced pw  ');

    expect(await verifySecret('  spaced pw  ', written().data.usrPasswordHash as string)).toBe(
      true,
    );
  });

  it('writes one audit row with the change date and the flag, never a password or a hash', async () => {
    await change();

    expect(audit.logEntityChange).toHaveBeenCalledTimes(1);
    const [entry, tx] = audit.logEntityChange.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(tx).toBe(prisma);
    expect(entry).toMatchObject({
      action: 'update',
      tableName: 'user_master',
      screenName: 'User Administration',
      pk: USER_ID,
      displayName: 'Cashier One',
      userId: USER_ID,
      originalRecord: {
        usrPasswordChangedOn: CHANGED_BEFORE.toISOString(),
        usrMustChangePassword: true,
      },
      modifiedRecord: { usrMustChangePassword: false },
    });
    const text = JSON.stringify(entry);
    expect(text).not.toContain('scrypt$');
    expect(text).not.toContain(CURRENT);
    expect(text).not.toContain(NEW);
    expect(text).not.toMatch(/hash/i);
  });

  it('refuses a wrong current password on currentPassword (400, not 401) and writes nothing', async () => {
    const refusal = await refusalOf(change('wrong-one', NEW));

    expect(refusal).toMatchObject({
      status: 400,
      body: {
        errors: [{ field: 'currentPassword', code: AuthErrorCode.CURRENT_PASSWORD_WRONG }],
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.logEntityChange).not.toHaveBeenCalled();
    // U9 is a later step: the hook logs only, nothing counts or locks yet.
    expect(prisma.userMaster.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('current password mismatch'));
  });

  it.each(['abc', '  ab  ', '', '      '])(
    'refuses a new password under %#: fewer than 4 characters without the end spaces',
    async (short) => {
      const refusal = await refusalOf(change(CURRENT, short));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'newPassword', code: AuthErrorCode.NEW_PASSWORD_TOO_SHORT }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('accepts exactly 4 characters (U7: no other rule)', async () => {
    expect(MIN_NEW_PASSWORD_LENGTH).toBe(4);
    await expect(change(CURRENT, 'abcd')).resolves.toMatchObject({ usrId: USER_ID });
  });

  it('refuses the current password as the new one', async () => {
    const refusal = await refusalOf(change(CURRENT, CURRENT));

    expect(refusal).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'newPassword', code: AuthErrorCode.NEW_PASSWORD_SAME }] },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks the current password before the new one', async () => {
    const refusal = await refusalOf(change('wrong-one', 'abc'));

    expect(refusal.body).toMatchObject({
      errors: [{ code: AuthErrorCode.CURRENT_PASSWORD_WRONG }],
    });
  });

  it('answers 401 AUTH_USER_INACTIVE for a user deactivated, deleted or locked since login', async () => {
    prisma.userMaster.findFirst.mockResolvedValue(null);

    const refusal = await refusalOf(change());

    expect(refusal).toMatchObject({
      status: 401,
      body: { errors: [{ code: AuthErrorCode.USER_INACTIVE }] },
    });
  });

  it('answers 401 AUTH_AUTHORIZATION_MISSING with no user in the request context', async () => {
    context.getUserId.mockReturnValue(null);

    const refusal = await refusalOf(change());

    expect(refusal).toMatchObject({
      status: 401,
      body: { errors: [{ code: AuthErrorCode.AUTHORIZATION_MISSING }] },
    });
    expect(prisma.userMaster.findFirst).not.toHaveBeenCalled();
  });

  it('never looks at any user but the token one', async () => {
    context.getUserId.mockReturnValue(OTHER_ID);

    await change();

    const reads = prisma.userMaster.findFirst.mock.calls as [{ where: { usrId: string } }][];
    expect(reads).toHaveLength(1);
    expect(reads[0][0].where.usrId).toBe(OTHER_ID);
    expect(written().where.usrId).toBe(OTHER_ID);
  });

  it('does not overwrite a password changed meanwhile (the verified hash is the write key)', async () => {
    prisma.userMaster.updateMany.mockResolvedValue({ count: 0 });

    const refusal = await refusalOf(change());

    expect(refusal).toMatchObject({
      status: 400,
      body: { errors: [{ code: AuthErrorCode.CURRENT_PASSWORD_WRONG }] },
    });
    expect(audit.logEntityChange).not.toHaveBeenCalled();
  });
});
