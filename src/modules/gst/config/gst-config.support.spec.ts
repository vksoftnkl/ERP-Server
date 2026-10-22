import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GST_CODES, GST_CREDENTIALS_MENU, GST_PROVIDERS_MENU } from './gst-config.constants';
import {
  GstConfigSupport,
  decimalOrNull,
  fromDateOnly,
  isoOrNull,
  keep,
  toDateOnly,
} from './gst-config.support';
import { GstCryptoService } from './gst-crypto.service';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const PROVIDERS_MENU_ID = 269;
const CREDENTIALS_MENU_ID = 270;

/** A user_menus row granting exactly the rights named. */
const grant = (...rights: string[]) => [
  Object.fromEntries(
    [
      'view',
      'create',
      'edit',
      'delete',
      'print',
      'export',
      'post',
      'cancel',
      'amend',
      'override',
      'retender',
    ].map((right) => [`um_can_${right}`, rights.includes(right)]),
  ),
];

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

const syncRefusalOf = (fn: () => unknown) => refusalOf(Promise.resolve().then(fn));

type PrismaMock = {
  menu: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
};

describe('GstConfigSupport', () => {
  let prisma: PrismaMock;
  let context: { getUserId: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let support: GstConfigSupport;

  beforeEach(() => {
    prisma = {
      menu: {
        findFirst: jest.fn(async ({ where }: { where: { menuName: string } }) =>
          where.menuName === GST_PROVIDERS_MENU.name
            ? { menuId: PROVIDERS_MENU_ID }
            : { menuId: CREDENTIALS_MENU_ID },
        ),
      },
      $queryRaw: jest.fn().mockResolvedValue(grant('view')),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    support = new GstConfigSupport(
      prisma as unknown as PrismaService,
      context as never,
      audit as never,
      new GstCryptoService(),
    );
  });

  /** The bound values of the n-th user_menus read: [userId, menuId]. */
  const rightsReadArgs = (n = 0) => prisma.$queryRaw.mock.calls[n].slice(1);

  describe('requireRight', () => {
    it('finds the menu by parent and name, then reads the caller’s flags on it', async () => {
      await expect(
        support.requireRight(GST_PROVIDERS_MENU, 'view', 'view GST providers'),
      ).resolves.toBeUndefined();

      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { menuParentId: 60, menuName: 'GST Providers' },
        select: { menuId: true },
      });
      expect(rightsReadArgs()).toEqual([USER_ID, PROVIDERS_MENU_ID]);
    });

    it('reads the GST Credentials menu by its own name', async () => {
      prisma.$queryRaw.mockResolvedValue(grant('post'));

      await support.requireRight(GST_CREDENTIALS_MENU, 'post', 'verify GST credentials');

      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { menuParentId: 60, menuName: 'GST Credentials' },
        select: { menuId: true },
      });
      expect(rightsReadArgs()).toEqual([USER_ID, CREDENTIALS_MENU_ID]);
    });

    it('refuses with a 403 that names the action, the menu and the column to grant', async () => {
      prisma.$queryRaw.mockResolvedValue(grant());

      const refusal = await refusalOf(
        support.requireRight(GST_PROVIDERS_MENU, 'view', 'view GST providers'),
      );

      const message = 'This user may not view GST providers (menu 269: um_can_view is not granted)';
      expect(refusal).toEqual({
        status: 403,
        body: {
          success: false,
          message,
          errors: [{ field: 'userId', message, code: 'GST_RIGHT_VIEW' }],
        },
      });
    });

    it.each(['create', 'edit', 'delete', 'post'] as const)(
      'codes a missing %s right GST_RIGHT_<RIGHT>',
      async (right) => {
        prisma.$queryRaw.mockResolvedValue(grant('view'));

        const refusal = await refusalOf(support.requireRight(GST_PROVIDERS_MENU, right, 'act'));

        expect(refusal).toMatchObject({
          status: 403,
          body: { errors: [{ code: `GST_RIGHT_${right.toUpperCase()}` }] },
        });
      },
    );

    it('looks the menu up once and remembers it', async () => {
      await support.requireRight(GST_PROVIDERS_MENU, 'view', 'view');
      await support.requireRight(GST_PROVIDERS_MENU, 'view', 'view');

      expect(prisma.menu.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('refuses everyone while the menu row is missing, and finds it once it exists', async () => {
      prisma.menu.findFirst.mockResolvedValueOnce(null);
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const refusal = await refusalOf(support.requireRight(GST_PROVIDERS_MENU, 'view', 'view'));
      expect(refusal.status).toBe(403);
      expect(rightsReadArgs(0)).toEqual([USER_ID, 0]);

      await support.requireRight(GST_PROVIDERS_MENU, 'view', 'view');
      expect(prisma.menu.findFirst).toHaveBeenCalledTimes(2);
      expect(rightsReadArgs(1)).toEqual([USER_ID, PROVIDERS_MENU_ID]);
    });

    it('refuses a call with no user without reading any rights', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(support.requireRight(GST_PROVIDERS_MENU, 'view', 'view'));

      expect(refusal.status).toBe(403);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('actor and audit', () => {
    it('acts as the request user, else the default actor', () => {
      expect(support.actor()).toBe(USER_ID);
      context.getUserId.mockReturnValue(null);
      expect(support.actor()).toBe(DEFAULT_ACTOR);
    });

    it('writes a master audit row inside the caller’s transaction', async () => {
      const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

      await support.audit(tx, {
        action: 'update',
        table: 'gst provider',
        screen: 'GST Provider',
        pk: 'pk-1',
        displayName: 'NIC',
        before: { a: 1 },
        after: { a: 2 },
        notes: 'GST provider updated',
      });

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        {
          action: 'update',
          tableName: 'gst provider',
          screenName: 'GST Provider',
          screenType: 'master',
          pk: 'pk-1',
          displayName: 'NIC',
          originalRecord: { a: 1 },
          modifiedRecord: { a: 2 },
          userId: USER_ID,
          notes: 'GST provider updated',
        },
        tx,
      );
    });
  });

  describe('refusals', () => {
    it('notFound is a 404 GST_NOT_FOUND naming the id', async () => {
      await expect(
        syncRefusalOf(() => support.notFound('gpvId', 'GST provider', 'abc')),
      ).resolves.toEqual({
        status: 404,
        body: {
          success: false,
          message: 'GST provider not found',
          errors: [
            {
              field: 'gpvId',
              message: 'No gst provider found with id abc',
              code: GST_CODES.NOT_FOUND,
            },
          ],
        },
      });
    });

    it('conflict is a 409 with the field and code given', async () => {
      await expect(
        syncRefusalOf(() => support.conflict('Duplicate', 'gpvCode', 'taken', 'X_CODE')),
      ).resolves.toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Duplicate',
          errors: [{ field: 'gpvCode', message: 'taken', code: 'X_CODE' }],
        },
      });
    });

    it('badRequest is a 400 Validation failed carrying every detail', async () => {
      const errors = [
        { field: 'a', message: 'm1', code: 'C1' },
        { field: 'b', message: 'm2', code: 'C2' },
      ];

      await expect(syncRefusalOf(() => support.badRequest(errors))).resolves.toEqual({
        status: 400,
        body: { success: false, message: 'Validation failed', errors },
      });
    });

    it('refuseDeleted is a 409 GST_ALREADY_DELETED', async () => {
      await expect(
        syncRefusalOf(() => support.refuseDeleted('gpaGpvId', 'GST provider', 'p-1')),
      ).resolves.toMatchObject({
        status: 409,
        body: {
          message: 'GST provider is deleted',
          errors: [
            {
              field: 'gpaGpvId',
              message: 'GST provider p-1 is deleted. It cannot be edited or used as a parent.',
              code: GST_CODES.ALREADY_DELETED,
            },
          ],
        },
      });
    });

    it('refuseParentChange is a 409 GST_PARENT_FIXED naming the stored parent', async () => {
      await expect(
        syncRefusalOf(() => support.refuseParentChange('gpaGpvId', 'provider p-1')),
      ).resolves.toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpaGpvId',
              message:
                'This row belongs to provider p-1. Create a new row under the other parent instead.',
              code: GST_CODES.PARENT_FIXED,
            },
          ],
        },
      });
    });
  });

  describe('translateWriteError', () => {
    const CODE_UNIQUE = {
      match: ['gpv_code'],
      field: 'gpvCode',
      message: 'code taken',
      code: GST_CODES.PROVIDER_CODE_DUPLICATE,
    };
    const ACCOUNT_UNIQUE = {
      match: ['ux_gpa_provider_env_service', 'gpa_environment'],
      field: 'gpaEnvironment',
      message: 'account taken',
      code: GST_CODES.ACCOUNT_DUPLICATE,
    };
    const translate = (error: unknown, uniques = [CODE_UNIQUE, ACCOUNT_UNIQUE]) =>
      syncRefusalOf(() => support.translateWriteError(error, uniques));

    it('turns a unique violation into the 409 of the index it names', async () => {
      const error = { code: 'P2002', meta: { target: 'ux_gpa_provider_env_service' } };

      await expect(translate(error)).resolves.toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Duplicate',
          errors: [
            {
              field: 'gpaEnvironment',
              message: 'account taken',
              code: GST_CODES.ACCOUNT_DUPLICATE,
            },
          ],
        },
      });
    });

    it('matches a partial index reported by its columns', async () => {
      const error = { code: 'P2002', meta: { target: ['gpa_gpv_id', 'gpa_environment'] } };

      await expect(translate(error)).resolves.toMatchObject({
        body: { errors: [{ code: GST_CODES.ACCOUNT_DUPLICATE }] },
      });
    });

    it('matches a raw query’s 23505 by the columns in its detail', async () => {
      const error = {
        code: 'P2010',
        meta: { code: '23505', message: 'Key (gpv_code)=(NIC) already exists.' },
      };

      await expect(translate(error)).resolves.toMatchObject({
        status: 409,
        body: { errors: [{ code: GST_CODES.PROVIDER_CODE_DUPLICATE }] },
      });
    });

    it('takes the only unique a caller names when the index cannot be told', async () => {
      await expect(translate({ code: 'P2002' }, [CODE_UNIQUE])).resolves.toMatchObject({
        body: { errors: [{ field: 'gpvCode', code: GST_CODES.PROVIDER_CODE_DUPLICATE }] },
      });
    });

    it('answers GST_DUPLICATE when several could have fired and none matched', async () => {
      await expect(
        translate({ code: 'P2002', meta: { target: 'ux_something_else' } }),
      ).resolves.toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Duplicate',
          errors: [
            {
              field: 'id',
              message: 'Refused by ux_something_else.',
              code: GST_CODES.DUPLICATE,
            },
          ],
        },
      });
      await expect(translate({ code: 'P2002' })).resolves.toMatchObject({
        body: { errors: [{ message: 'Refused by a unique index.' }] },
      });
    });

    it('turns a CHECK violation into a 400 on the field it guards', async () => {
      const error = {
        code: 'P2010',
        meta: {
          code: '23514',
          message: 'new row for relation "gst_provider" violates check constraint "ck_gpv_timeout"',
        },
      };

      await expect(translate(error)).resolves.toEqual({
        status: 400,
        body: {
          success: false,
          message: 'Validation failed',
          errors: [
            { field: 'gpvTimeoutMs', message: 'refused by ck_gpv_timeout', code: GST_CODES.CHECK },
          ],
        },
      });
    });

    it('names an unknown CHECK by itself', async () => {
      const error = new Error('Code 23514: new row violates check constraint "ck_gst_new_rule"');

      await expect(translate(error)).resolves.toMatchObject({
        body: { errors: [{ field: 'ck_gst_new_rule', code: GST_CODES.CHECK }] },
      });
    });

    it('lets any other failure through for the caller to rethrow', () => {
      expect(
        support.translateWriteError(new Error('connection reset'), [CODE_UNIQUE]),
      ).toBeUndefined();
      expect(support.translateWriteError({ code: 'P2003' }, [CODE_UNIQUE])).toBeUndefined();
    });
  });
});

describe('gst-config.support helpers', () => {
  it('toDateOnly writes the calendar day as UTC midnight and passes null / undefined through', () => {
    expect(toDateOnly('2026-04-01')).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(toDateOnly('2026-04-01T23:59:59+05:30')).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeUndefined();
  });

  it('fromDateOnly and isoOrNull read a column back, null as null', () => {
    const day = new Date('2027-03-31T00:00:00.000Z');
    expect(fromDateOnly(day)).toBe('2027-03-31');
    expect(fromDateOnly(null)).toBeNull();
    expect(isoOrNull(day)).toBe('2027-03-31T00:00:00.000Z');
    expect(isoOrNull(null)).toBeNull();
  });

  it('decimalOrNull turns a Decimal into a number', () => {
    expect(decimalOrNull(new Prisma.Decimal('1250.50'))).toBe(1250.5);
    expect(decimalOrNull(null)).toBeNull();
  });

  it('keep: what was sent (null included), else what is stored, else the default', () => {
    expect(keep('sent', 'stored', 'default')).toBe('sent');
    expect(keep<string | null>(null, 'stored', 'default')).toBeNull();
    expect(keep(undefined, 'stored', 'default')).toBe('stored');
    expect(keep<string | null>(undefined, null, 'default')).toBeNull();
    expect(keep(undefined, undefined, 'default')).toBe('default');
  });
});
