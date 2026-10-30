import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MenuRight, NO_RIGHTS, RIGHT_COLUMN, assertMenuRight, loadRights } from './rights';

const USER_ID = '019f0000-0000-7000-8000-0000000000e1';
const RECEIPTS_MENU = 99;

type UserMenuRow = Partial<Record<string, boolean | null>>;

const clientWith = (rows: UserMenuRow[]) => {
  const $queryRaw = jest.fn(async (..._args: unknown[]) => rows);
  return { $queryRaw, client: { $queryRaw } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'> };
};

describe('loadRights', () => {
  it('reads every flag of the user’s live menu row', async () => {
    const { client, $queryRaw } = clientWith([
      {
        um_can_view: true,
        um_can_create: true,
        um_can_edit: false,
        um_can_delete: false,
        um_can_print: true,
        um_can_export: false,
        um_can_post: true,
        um_can_cancel: false,
        um_can_amend: true,
        um_can_override: false,
        um_can_retender: true,
      },
    ]);

    await expect(loadRights(client, USER_ID, RECEIPTS_MENU)).resolves.toEqual({
      view: true,
      create: true,
      edit: false,
      delete: false,
      print: true,
      export: false,
      post: true,
      cancel: false,
      amend: true,
      override: false,
      retender: true,
    });
    const [strings, ...values] = $queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual([USER_ID, RECEIPTS_MENU]);
    expect(strings.join('?')).toContain('um_is_deleted = false');
  });

  // Defaulting a missing permission to TRUE is how a permission system stops being one.
  it('grants nothing when the user has no row on the menu', async () => {
    await expect(loadRights(clientWith([]).client, USER_ID, RECEIPTS_MENU)).resolves.toEqual(
      NO_RIGHTS,
    );
  });

  it('reads a null flag as not granted', async () => {
    const rights = await loadRights(
      clientWith([{ um_can_view: true, um_can_post: null }]).client,
      USER_ID,
      RECEIPTS_MENU,
    );

    expect(rights).toMatchObject({ view: true, post: false, retender: false });
  });
});

describe('assertMenuRight', () => {
  const params = (right: MenuRight, userId: string | null = USER_ID) => ({
    userId,
    menuId: RECEIPTS_MENU,
    right,
    codePrefix: 'RCT',
    action: 'post receipts',
  });

  it('returns every right when the one asked for is held', async () => {
    const { client } = clientWith([{ um_can_view: true, um_can_post: true }]);

    await expect(assertMenuRight(client, params('post'))).resolves.toMatchObject({
      view: true,
      post: true,
      cancel: false,
    });
  });

  it('refuses with 403, naming the column to grant and a module-prefixed code', async () => {
    const { client } = clientWith([{ um_can_view: true }]);

    const result = assertMenuRight(client, params('post'));

    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toMatchObject({
      response: {
        message:
          'This user may not post receipts (menu 99: um_can_post is not granted)',
        errors: [
          {
            field: 'userId',
            code: 'RCT_RIGHT_POST',
            message: 'This user may not post receipts (menu 99: um_can_post is not granted)',
          },
        ],
      },
    });
  });

  it('refuses a call with no user without reading the table', async () => {
    const { client, $queryRaw } = clientWith([{ um_can_view: true }]);

    await expect(assertMenuRight(client, params('view', null))).rejects.toMatchObject({
      response: { errors: [{ code: 'RCT_RIGHT_VIEW' }] },
    });
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('does not hand back the frozen NO_RIGHTS object itself', async () => {
    expect(Object.isFrozen(NO_RIGHTS)).toBe(true);
    expect(Object.values(NO_RIGHTS).every((v) => v === false)).toBe(true);
  });

  it.each(Object.entries(RIGHT_COLUMN))('names %s as %s', async (right, column) => {
    const { client } = clientWith([]);

    await expect(assertMenuRight(client, params(right as MenuRight))).rejects.toMatchObject({
      response: {
        errors: [
          {
            code: `RCT_RIGHT_${right.toUpperCase()}`,
            message: expect.stringContaining(`${column} is not granted`),
          },
        ],
      },
    });
  });
});
