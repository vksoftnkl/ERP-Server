import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { actorOf, AppVersionAdminGuard, ReleaseAccess } from './app-version-admin.guard';

const USER_ID = '0195a1c8-fa62-7ca1-a5e1-81921334a794';

class Routes {
  adminOnly(): void {}
  @ReleaseAccess()
  release(): void {}
}

const contextFor = (user: unknown, handler: keyof Routes = 'adminOnly'): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    // Only read for its metadata, never called.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
  }) as unknown as ExecutionContext;

describe('AppVersionAdminGuard (Part B Step 2 Rev 2, D5)', () => {
  let findFirst: jest.Mock;
  let guard: AppVersionAdminGuard;

  beforeEach(() => {
    findFirst = jest.fn();
    guard = new AppVersionAdminGuard(
      { userMaster: { findFirst } } as unknown as PrismaService,
      new Reflector(),
    );
  });

  it.each(['ADMIN', 'SUPER ADMIN', 'super admin'])('lets a live %s through', async (usrType) => {
    findFirst.mockResolvedValue({ usrType });
    await expect(guard.canActivate(contextFor({ sub: USER_ID }))).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { usrId: USER_ID, usrIsActive: true, usrIsDeleted: false },
      select: { usrType: true },
    });
  });

  it('refuses any other role, a gone user and a non-uuid subject with 403 APP_VERSION_ADMIN_ONLY', async () => {
    findFirst.mockResolvedValue({ usrType: 'STORE MANAGER' });
    await expect(guard.canActivate(contextFor({ sub: USER_ID }))).rejects.toMatchObject({
      response: { errors: [{ code: 'APP_VERSION_ADMIN_ONLY' }] },
    });
    findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor({ sub: USER_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    findFirst.mockClear();
    await expect(guard.canActivate(contextFor({ sub: 'tester1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(guard.canActivate(contextFor(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('the audit actor is the signed-in user id', () => {
    expect(actorOf({ user: { sub: USER_ID } } as never)).toBe(USER_ID);
  });

  it('Step 4 (E5): RELEASE MANAGER passes a release route, never an admin route', async () => {
    findFirst.mockResolvedValue({ usrType: 'RELEASE MANAGER' });
    await expect(guard.canActivate(contextFor({ sub: USER_ID }, 'release'))).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor({ sub: USER_ID }, 'adminOnly')),
    ).rejects.toMatchObject({ response: { errors: [{ code: 'APP_VERSION_ADMIN_ONLY' }] } });
    findFirst.mockResolvedValue({ usrType: 'ADMIN' });
    await expect(guard.canActivate(contextFor({ sub: USER_ID }, 'release'))).resolves.toBe(true);
    findFirst.mockResolvedValue({ usrType: 'CASHIER' });
    await expect(guard.canActivate(contextFor({ sub: USER_ID }, 'release'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
