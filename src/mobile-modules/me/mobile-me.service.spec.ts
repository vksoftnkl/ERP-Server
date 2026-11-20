import { MobileMeService } from './mobile-me.service';

const LOGIN = '019e441b-6e48-7918-b246-b857ffb35db1';
const EMPLOYEE = '01a11695-f492-791d-9b88-111a44b8666c';

function make(opts: {
  userId: string | null;
  user?: object | null;
  menus: Record<number, object>;
}) {
  const prisma = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('FROM public.user_master')) return opts.user ? [opts.user] : [];
      if (sql.includes('FROM public.user_menus')) {
        const menu = opts.menus[values[1] as number];
        return menu ? [menu] : [];
      }
      throw new Error(`unscripted read: ${sql}`);
    }),
  };
  return new MobileMeService(prisma as never, { getUserId: () => opts.userId } as never);
}

describe('MobileMeService.me', () => {
  it('the login, its employee and its rights keyed by menu id as text (no row = all false)', async () => {
    const service = make({
      userId: LOGIN,
      user: { userId: LOGIN, loginName: 'RAVI', employeeId: EMPLOYEE, employeeName: 'Ravi' },
      menus: {
        11: {
          um_can_view: true,
          um_can_create: true,
          um_can_post: false,
          um_can_cancel: null,
          um_can_print: true,
          um_can_edit: true,
        },
        99: {
          um_can_view: true,
          um_can_create: false,
          um_can_post: true,
          um_can_cancel: true,
          um_can_print: false,
        },
      },
    });
    await expect(service.me()).resolves.toEqual({
      userId: LOGIN,
      loginName: 'RAVI',
      employeeId: EMPLOYEE,
      employeeName: 'Ravi',
      rights: {
        '11': { view: true, create: true, post: false, cancel: false, print: true },
        '12': { view: false, create: false, post: false, cancel: false, print: false },
        '99': { view: true, create: false, post: true, cancel: true, print: false },
      },
    });
  });

  it('no token: 401 AUTH_AUTHORIZATION_MISSING; a deleted login: 401 AUTH_USER_INACTIVE', async () => {
    await expect(make({ userId: null, menus: {} }).me()).rejects.toMatchObject({
      status: 401,
      response: { errors: [expect.objectContaining({ code: 'AUTH_AUTHORIZATION_MISSING' })] },
    });
    await expect(make({ userId: LOGIN, user: null, menus: {} }).me()).rejects.toMatchObject({
      status: 401,
      response: { errors: [expect.objectContaining({ code: 'AUTH_USER_INACTIVE' })] },
    });
  });
});
