import { HttpException, HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { UserMaster } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UserAdminErrorCode } from '../settings/userAdministration/types/user-administration.enum';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const CALLER_ID = '019c6f6c-be87-7a11-8905-36092c46af09';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const USER = {
  usrId: USER_ID,
  usrLoginName: 'john.doe',
  usrDisplayName: 'John',
  usrMobileNo: '+919876543210',
  usrPasswordHash: 'scrypt$salt$hash',
  usrType: 'USER',
  usrIsActive: true,
  usrIsDeleted: false,
  usrCreatedOn: CREATED_ON,
  usrModifiedOn: null,
} as unknown as UserMaster;

const RESPONSE = {
  usrId: USER_ID,
  usrLoginName: 'john.doe',
  usrMobileNo: '+919876543210',
  usrIsActive: true,
  usrCreatedOn: CREATED_ON.toISOString(),
  usrModifiedOn: null,
};

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

describe('UsersController', () => {
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let prisma: { userMaster: { findFirst: jest.Mock } };
  let context: { getUserId: jest.Mock };
  let controller: UsersController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(USER),
      findAll: jest.fn().mockResolvedValue([USER]),
      findOne: jest.fn().mockResolvedValue(USER),
      update: jest.fn().mockResolvedValue(USER),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    // The caller's own row, read by the SUPER ADMIN gate.
    prisma = { userMaster: { findFirst: jest.fn().mockResolvedValue({ usrType: 'SUPER ADMIN' }) } };
    context = { getUserId: jest.fn().mockReturnValue(CALLER_ID) };
    controller = new UsersController(
      service as unknown as UsersService,
      prisma as unknown as PrismaService,
      context as never,
    );
  });

  const routes: Array<[keyof typeof service, () => Promise<unknown>]> = [
    ['create', () => controller.create({ user_name: 'a', user_phone: '', user_password: 'p' })],
    ['findAll', () => controller.findAll()],
    ['findOne', () => controller.findOne(USER_ID)],
    ['update', () => controller.update(USER_ID, { user_phone: '1' })],
    ['remove', () => controller.remove(USER_ID)],
  ];

  // ── the SUPER ADMIN gate (notes 125 §3) ───────────────────────────────────
  describe.each(routes)('%s', (name, call) => {
    const serviceMethod = () => service[name];

    it('reads the caller from user_master, live and active only', async () => {
      await call();

      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: { usrId: CALLER_ID, usrIsActive: true, usrIsDeleted: false },
        select: { usrType: true },
      });
      expect(serviceMethod()).toHaveBeenCalled();
    });

    it.each([
      [
        'a caller who is not a SUPER ADMIN',
        () => prisma.userMaster.findFirst.mockResolvedValue({ usrType: 'ADMIN' }),
      ],
      [
        'a caller with no live, active row',
        () => prisma.userMaster.findFirst.mockResolvedValue(null),
      ],
      ['no logged-in caller', () => context.getUserId.mockReturnValue(null)],
      ['a caller id that is not a uuid', () => context.getUserId.mockReturnValue('admin')],
    ])(
      'refuses %s with 403 USER_ROLE_RESERVED before the service runs',
      async (_label, arrange) => {
        arrange();

        const refusal = await refusalOf(call());

        expect(refusal).toEqual({
          status: 403,
          body: {
            success: false,
            message: 'User role reserved',
            errors: [
              {
                field: 'userId',
                code: UserAdminErrorCode.ROLE_RESERVED,
                message: '/users is for a SUPER ADMIN only: manage users on /user-administration',
              },
            ],
          },
        });
        expect(serviceMethod()).not.toHaveBeenCalled();
      },
    );
  });

  // ── the answers ───────────────────────────────────────────────────────────
  describe('what goes back', () => {
    it('answers only the safe columns, never the password hash or the user type', async () => {
      const created = await controller.create({
        user_name: 'john.doe',
        user_phone: '+919876543210',
        user_password: 'StrongPassword123!',
      });

      expect(created).toEqual(RESPONSE);
      expect(JSON.stringify(created)).not.toContain('scrypt');
    });

    it('gives the modified time as ISO text once there is one', async () => {
      const modifiedOn = new Date('2026-10-02T06:00:00.000Z');
      service.findOne.mockResolvedValue({ ...USER, usrModifiedOn: modifiedOn });

      await expect(controller.findOne(USER_ID)).resolves.toMatchObject({
        usrModifiedOn: '2026-10-02T06:00:00.000Z',
      });
    });

    it('passes the body and id through to the service', async () => {
      const body = { user_phone: '1' };

      await expect(controller.findAll()).resolves.toEqual([RESPONSE]);
      await controller.update(USER_ID, body);
      await expect(controller.remove(USER_ID)).resolves.toBeUndefined();

      expect(service.update).toHaveBeenCalledWith(USER_ID, body);
      expect(service.remove).toHaveBeenCalledWith(USER_ID);
    });

    it('answers a delete with 204 No Content', () => {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, UsersController.prototype.remove)).toBe(
        HttpStatus.NO_CONTENT,
      );
    });
  });
});
