import { HttpException } from '@nestjs/common';
import { UserMaster } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { verifySecret } from '../../common/utils/secret-hash.utils';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersErrorCode } from './types/users-error-codes';
import { UsersService } from './users.service';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

/** Only the columns the service reads; the rest of user_master is irrelevant here. */
const userRow = (overrides: Partial<UserMaster> = {}) =>
  ({
    usrId: USER_ID,
    usrLoginName: 'john.doe',
    usrDisplayName: 'john.doe',
    usrMobileNo: '+919876543210',
    usrPasswordHash: 'scrypt$old$hash',
    usrIsActive: true,
    usrIsDeleted: false,
    usrCreatedOn: CREATED_ON,
    usrModifiedOn: null,
    ...overrides,
  }) as UserMaster;

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

/** The body as the ValidationPipe hands it over: every declared field an own key. */
const updateOf = (plain: object) => plainToInstance(UpdateUserDto, plain);

type PrismaMock = {
  userMaster: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe('UsersService', () => {
  let prisma: PrismaMock;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      userMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: Partial<UserMaster> }) => userRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<UserMaster> }) => userRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  const createdData = () =>
    (prisma.userMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.userMaster.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('writes the trimmed name as both login and display name, with the phone trimmed', async () => {
      await service.create({
        user_name: '  john.doe  ',
        user_phone: ' +919876543210 ',
        user_password: 'StrongPassword123!',
      });

      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: { usrLoginName: { equals: 'john.doe', mode: 'insensitive' }, usrIsDeleted: false },
      });
      expect(createdData()).toEqual({
        usrLoginName: 'john.doe',
        usrDisplayName: 'john.doe',
        usrMobileNo: '+919876543210',
        usrPasswordHash: expect.stringMatching(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/),
      });
    });

    it('stores the password as a hash the sign-in check accepts, and never in plain', async () => {
      await service.create({ user_name: 'john', user_phone: '', user_password: 'S3cret!' });

      const hash = createdData().usrPasswordHash as string;
      expect(hash).not.toContain('S3cret!');
      await expect(verifySecret('S3cret!', hash)).resolves.toBe(true);
      await expect(verifySecret('s3cret!', hash)).resolves.toBe(false);
    });

    it('salts every hash, so the same password never stores the same value twice', async () => {
      await service.create({ user_name: 'a', user_phone: '', user_password: 'same' });
      await service.create({ user_name: 'b', user_phone: '', user_password: 'same' });

      const [first, second] = prisma.userMaster.create.mock.calls.map(
        ([args]: [{ data: { usrPasswordHash: string } }]) => args.data.usrPasswordHash,
      );
      expect(first).not.toBe(second);
    });

    it.each([
      ['blank', '   '],
      ['missing', undefined],
    ])('stores no phone when it is %s', async (_label, phone) => {
      await service.create({
        user_name: 'john',
        user_phone: phone as unknown as string,
        user_password: 'x',
      });

      expect(createdData().usrMobileNo).toBeNull();
    });

    it('refuses a login name another live user holds, in any case, and writes nothing', async () => {
      prisma.userMaster.findFirst.mockResolvedValue(userRow({ usrLoginName: 'John.Doe' }));

      const refusal = await refusalOf(
        service.create({ user_name: 'john.doe', user_phone: '', user_password: 'x' }),
      );

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'User with this username already exists',
          errors: [
            {
              field: 'user_name',
              message: 'User with this username already exists',
              code: UsersErrorCode.LOGIN_NAME_TAKEN,
            },
          ],
        },
      });
      expect(prisma.userMaster.create).not.toHaveBeenCalled();
    });
  });

  // ── reads ─────────────────────────────────────────────────────────────────
  describe('reads', () => {
    it('lists the live users only', async () => {
      prisma.userMaster.findMany.mockResolvedValue([userRow()]);

      await expect(service.findAll()).resolves.toEqual([userRow()]);
      expect(prisma.userMaster.findMany).toHaveBeenCalledWith({ where: { usrIsDeleted: false } });
    });

    it('finds a live user by login name, trimmed and in any case', async () => {
      prisma.userMaster.findFirst.mockResolvedValue(userRow());

      await expect(service.findByUsername('  JOHN.DOE ')).resolves.toEqual(userRow());
      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: { usrLoginName: { equals: 'JOHN.DOE', mode: 'insensitive' }, usrIsDeleted: false },
      });
    });

    it('answers null for a blank login name without asking the database', async () => {
      await expect(service.findByUsername('   ')).resolves.toBeNull();
      expect(prisma.userMaster.findFirst).not.toHaveBeenCalled();
    });

    it('finds one live user by id', async () => {
      prisma.userMaster.findFirst.mockResolvedValue(userRow());

      await expect(service.findOne(USER_ID)).resolves.toEqual(userRow());
      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: { usrId: USER_ID, usrIsDeleted: false },
      });
    });

    it('refuses an id with no live user', async () => {
      const refusal = await refusalOf(service.findOne(USER_ID));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'User not found',
          errors: [{ field: 'id', message: 'User not found', code: UsersErrorCode.NOT_FOUND }],
        },
      });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    beforeEach(() => {
      prisma.userMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          // The existence read names the id; the duplicate-name read names a login name.
          'usrLoginName' in where ? null : userRow(),
      );
    });

    it('refuses an id with no live user and writes nothing', async () => {
      prisma.userMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.update(USER_ID, updateOf({ user_phone: '1' })));

      expect(refusal.status).toBe(404);
      expect(prisma.userMaster.update).not.toHaveBeenCalled();
    });

    it('writes nothing and answers the stored user when the body changes nothing', async () => {
      await expect(service.update(USER_ID, updateOf({}))).resolves.toEqual(userRow());

      expect(prisma.userMaster.update).not.toHaveBeenCalled();
    });

    it('renames login and display name after checking the name against every other user', async () => {
      await service.update(USER_ID, updateOf({ user_name: ' jane.doe ' }));

      expect(prisma.userMaster.findFirst).toHaveBeenLastCalledWith({
        where: {
          usrLoginName: { equals: 'jane.doe', mode: 'insensitive' },
          usrIsDeleted: false,
          NOT: { usrId: USER_ID },
        },
      });
      expect(prisma.userMaster.update).toHaveBeenCalledWith({
        where: { usrId: USER_ID },
        data: {
          usrModifiedOn: expect.any(Date),
          usrLoginName: 'jane.doe',
          usrDisplayName: 'jane.doe',
        },
      });
    });

    it('refuses a new name another live user holds', async () => {
      prisma.userMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'usrLoginName' in where ? userRow({ usrId: 'other' }) : userRow(),
      );

      const refusal = await refusalOf(service.update(USER_ID, updateOf({ user_name: 'jane' })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'user_name', code: UsersErrorCode.LOGIN_NAME_TAKEN }] },
      });
      expect(prisma.userMaster.update).not.toHaveBeenCalled();
    });

    it('skips the name check when the name is unchanged', async () => {
      await service.update(USER_ID, updateOf({ user_name: 'john.doe' }));

      expect(prisma.userMaster.findFirst).toHaveBeenCalledTimes(1);
      expect(updatedData()).toMatchObject({ usrLoginName: 'john.doe' });
    });

    it('ignores a blank name rather than clearing the login', async () => {
      await service.update(USER_ID, updateOf({ user_name: '   ', user_phone: '2' }));

      expect(updatedData()).not.toHaveProperty('usrLoginName');
      expect(updatedData()).not.toHaveProperty('usrDisplayName');
    });

    it('sets the phone trimmed, and clears it when sent blank', async () => {
      await service.update(USER_ID, updateOf({ user_phone: ' 98765 ' }));
      await service.update(USER_ID, updateOf({ user_phone: '  ' }));

      const [set, cleared] = prisma.userMaster.update.mock.calls.map(
        ([args]: [{ data: Record<string, unknown> }]) => args.data,
      );
      expect(set.usrMobileNo).toBe('98765');
      expect(cleared.usrMobileNo).toBeNull();
    });

    it('re-hashes a new password and leaves the rest alone', async () => {
      await service.update(USER_ID, updateOf({ user_password: 'NewPass!1' }));

      const data = updatedData();
      expect(Object.keys(data).sort()).toEqual(['usrModifiedOn', 'usrPasswordHash']);
      await expect(verifySecret('NewPass!1', data.usrPasswordHash as string)).resolves.toBe(true);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('soft-deletes and deactivates a live user', async () => {
      await expect(service.remove(USER_ID)).resolves.toBeUndefined();

      expect(prisma.userMaster.updateMany).toHaveBeenCalledWith({
        where: { usrId: USER_ID, usrIsDeleted: false },
        data: { usrIsDeleted: true, usrIsActive: false, usrModifiedOn: expect.any(Date) },
      });
    });

    it('refuses an id with no live user, a deleted one included', async () => {
      prisma.userMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.remove(USER_ID));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: `User with id ${USER_ID} not found`,
          errors: [
            {
              field: 'id',
              message: `User with id ${USER_ID} not found`,
              code: UsersErrorCode.NOT_FOUND,
            },
          ],
        },
      });
    });
  });
});
