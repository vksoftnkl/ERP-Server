import { PrismaService } from '../../../database/prisma/prisma.service';
import { callerIsSuperAdmin } from './super-admin';
import { UserType } from './types/user-administration.enum';

const CALLER_ID = '019c6f6c-be87-7a11-8905-36092c46f101';

describe('callerIsSuperAdmin', () => {
  let findFirst: jest.Mock;
  const client = () => ({ userMaster: { findFirst } }) as unknown as PrismaService;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ usrType: UserType.SUPER_ADMIN });
  });

  it.each([null, undefined, '', 'admin', 'system-job'])(
    'is false for a caller id that is not a uuid (%p), without a read',
    async (userId) => {
      await expect(callerIsSuperAdmin(client(), userId)).resolves.toBe(false);
      expect(findFirst).not.toHaveBeenCalled();
    },
  );

  it('reads the role from the live, active user row, not the token', async () => {
    await expect(callerIsSuperAdmin(client(), CALLER_ID)).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { usrId: CALLER_ID, usrIsActive: true, usrIsDeleted: false },
      select: { usrType: true },
    });
  });

  it.each([
    ['holds another role', { usrType: UserType.ADMIN }],
    ['is inactive, deleted or unknown', null],
  ])('is false when the caller %s', async (_label, row) => {
    findFirst.mockResolvedValue(row);

    await expect(callerIsSuperAdmin(client(), CALLER_ID)).resolves.toBe(false);
  });
});
