import { HttpException } from '@nestjs/common';
import { UserLoginSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { UserLoginSessionsService } from './user-login-sessions.service';
import { UserLoginSessionsErrorCode } from './types/user-login-sessions-error-codes';

const ULS_ID = '019c6f6c-be87-7a11-8905-36092c46f901';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f902';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46f903';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f904';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46f905';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46f906';
const LOGIN_ON = new Date('2026-10-19T03:30:00.000Z');

const sessionRow = (overrides: Partial<UserLoginSession> = {}): UserLoginSession => ({
  ulsId: ULS_ID,
  ulsCompanyId: COMPANY_ID,
  ulsBranchId: BRANCH_ID,
  ulsUserId: USER_ID,
  ulsDeviceId: DEVICE_ID,
  ulsSessionId: SESSION_ID,
  ulsSessionToken: null,
  ulsRefreshTokenId: null,
  ulsLoginOn: LOGIN_ON,
  ulsLogoutOn: null,
  ulsLogoutType: null,
  ulsLoginStatus: 'SUCCESS',
  ulsFailReason: null,
  ulsIpAddress: '10.0.0.5',
  ulsUserAgent: null,
  ulsAppVersion: '4.2.0',
  ulsIsActiveSession: true,
  ulsIsActive: true,
  ulsIsDeleted: false,
  ulsSyncDate: null,
  ulsCreatedOn: LOGIN_ON,
  ulsCreatedBy: USER_ID,
  ulsModifiedOn: LOGIN_ON,
  ulsModifiedBy: USER_ID,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
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

type PrismaMock = {
  userLoginSession: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('UserLoginSessionsService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let grid: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  let service: UserLoginSessionsService;

  beforeEach(() => {
    prisma = {
      userLoginSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<UserLoginSession> }) => sessionRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<UserLoginSession> }) => sessionRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    grid = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({ isValid: true, normalizedSql: 'SELECT 1' })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    service = new UserLoginSessionsService(
      prisma as unknown as PrismaService,
      audit as never,
      grid as never,
      { getUserId: jest.fn().mockReturnValue(USER_ID) } as never,
    );
  });

  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create (no ulsId)', () => {
    it('writes the scope, the creator and only the optional fields sent', async () => {
      await service.save({
        ulsCompanyId: COMPANY_ID,
        ulsBranchId: BRANCH_ID,
        ulsUserId: USER_ID,
        ulsSessionId: SESSION_ID,
        ulsLoginStatus: 'SUCCESS',
      });

      expect(prisma.userLoginSession.create).toHaveBeenCalledWith({
        data: {
          ulsCompanyId: COMPANY_ID,
          ulsBranchId: BRANCH_ID,
          ulsUserId: USER_ID,
          ulsCreatedOn: expect.any(Date),
          ulsCreatedBy: USER_ID,
          ulsSessionId: SESSION_ID,
          ulsLoginStatus: 'SUCCESS',
        },
      });
    });

    it('audits the new session under its session id', async () => {
      const payload = await service.save({ ulsUserId: USER_ID, ulsSessionId: SESSION_ID });

      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'user login sessions',
        displayName: SESSION_ID,
        originalRecord: null,
        modifiedRecord: payload,
      });
      expect(payload).toMatchObject({ ulsLoginOn: LOGIN_ON.toISOString(), ulsLogoutOn: null });
    });

    it('audits a session with no session id under its row id', async () => {
      prisma.userLoginSession.create.mockResolvedValue(sessionRow({ ulsSessionId: null }));

      await service.save({ ulsUserId: USER_ID });

      expect(auditEntry().displayName).toBe(ULS_ID);
    });

    it('answers a unique-index race (P2002) with a 409 on ulsSessionId', async () => {
      prisma.userLoginSession.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ ulsUserId: USER_ID }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'ulsSessionId', code: UserLoginSessionsErrorCode.DUPLICATE }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.userLoginSession.create.mockRejectedValue(failure);

      await expect(service.save({ ulsUserId: USER_ID })).rejects.toBe(failure);
    });
  });

  describe('save — update (ulsId present)', () => {
    it('refuses an id that names no live session', async () => {
      const refusal = await refusalOf(service.save({ ulsId: ULS_ID, ulsUserId: USER_ID }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'ulsId', code: UserLoginSessionsErrorCode.NOT_FOUND }] },
      });
      expect(prisma.userLoginSession.update).not.toHaveBeenCalled();
    });

    it('records a logout and audits the before and after', async () => {
      prisma.userLoginSession.findFirst.mockResolvedValue(sessionRow());
      const logoutOn = new Date('2026-10-19T12:00:00.000Z');

      const payload = await service.save({
        ulsId: ULS_ID,
        ulsUserId: USER_ID,
        ulsLogoutOn: logoutOn,
        ulsLogoutType: 'MANUAL',
        ulsIsActiveSession: false,
        ulsModifiedBy: 'logout-hook',
      });

      expect(prisma.userLoginSession.update).toHaveBeenCalledWith({
        where: { ulsId: ULS_ID },
        data: expect.objectContaining({
          ulsUserId: USER_ID,
          ulsLogoutOn: logoutOn,
          ulsLogoutType: 'MANUAL',
          ulsIsActiveSession: false,
          ulsModifiedOn: expect.any(Date),
          ulsModifiedBy: 'logout-hook',
        }) as object,
      });
      expect(payload.ulsLogoutOn).toBe(logoutOn.toISOString());
      expect(auditEntry()).toMatchObject({
        action: 'update',
        userId: 'logout-hook',
        originalRecord: expect.objectContaining({ ulsIsActiveSession: true }),
        modifiedRecord: payload,
      });
    });
  });

  describe('list', () => {
    it('refuses with a 404 when no grid is configured for login sessions', async () => {
      const refusal = await refusalOf(service.list({}));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [{ field: 'list', code: UserLoginSessionsErrorCode.GRID_NOT_CONFIGURED }],
        },
      });
    });

    it('returns the configured grid page', async () => {
      grid.loadCandidates.mockResolvedValue([{ gridId: 4n, gridSql: 'SELECT * FROM uls' }]);
      grid.runPagedQuery.mockResolvedValue({ items: [{ ulsId: ULS_ID }], total: 1 });

      await expect(service.list({})).resolves.toEqual({
        items: [{ ulsId: ULS_ID }],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      });
      expect(grid.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'user_login_sessions_grid' }),
      );
    });
  });

  describe('getById', () => {
    it('returns the live session', async () => {
      prisma.userLoginSession.findFirst.mockResolvedValue(sessionRow());

      await expect(service.getById(ULS_ID)).resolves.toMatchObject({
        ulsId: ULS_ID,
        ulsSessionId: SESSION_ID,
      });
      expect(prisma.userLoginSession.findFirst).toHaveBeenCalledWith({
        where: { ulsId: ULS_ID, ulsIsDeleted: false },
      });
    });

    it('refuses an id with no live session', async () => {
      const refusal = await refusalOf(service.getById(ULS_ID));

      expect(refusal.status).toBe(404);
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live session', async () => {
      const refusal = await refusalOf(service.softDelete(ULS_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'ulsId', code: UserLoginSessionsErrorCode.NOT_FOUND }] },
      });
      expect(prisma.userLoginSession.updateMany).not.toHaveBeenCalled();
    });

    it('closes an open session, stamping the logout time with the delete time', async () => {
      prisma.userLoginSession.findFirst.mockResolvedValue(sessionRow());

      await expect(service.softDelete(ULS_ID)).resolves.toEqual({ ulsId: ULS_ID, deleted: true });

      const { data } = prisma.userLoginSession.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        ulsIsDeleted: true,
        ulsIsActive: false,
        ulsIsActiveSession: false,
        ulsLogoutOn: expect.any(Date),
        ulsModifiedOn: expect.any(Date),
        ulsModifiedBy: USER_ID,
      });
      expect(data.ulsLogoutOn).toBe(data.ulsModifiedOn);
      expect(auditEntry()).toMatchObject({ action: 'cancel', displayName: SESSION_ID });
    });

    it('keeps the logout time of a session that had already ended', async () => {
      const loggedOutOn = new Date('2026-10-19T09:00:00.000Z');
      prisma.userLoginSession.findFirst.mockResolvedValue(sessionRow({ ulsLogoutOn: loggedOutOn }));

      await service.softDelete(ULS_ID);

      expect(prisma.userLoginSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ulsLogoutOn: loggedOutOn }) as object,
        }),
      );
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.userLoginSession.findFirst.mockResolvedValue(sessionRow());
      prisma.userLoginSession.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(ULS_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
