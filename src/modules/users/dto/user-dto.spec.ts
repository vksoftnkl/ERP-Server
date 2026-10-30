import { HttpException } from '@nestjs/common';
import { validateDto } from '../../../common/utils/request-payload-validation.util';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

const BODY = { user_name: 'john.doe', user_phone: '+919876543210', user_password: 'S3cret!' };

/** The fields the house ValidationPipe refuses, or [] when it lets the body through. */
async function refusedFields(body: object, metatype: typeof CreateUserDto | typeof UpdateUserDto) {
  try {
    await validateDto(body, metatype);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: { field: string }[] }).errors.map((e) => e.field);
  }
}

describe('CreateUserDto', () => {
  it('accepts a name, phone and password', async () => {
    await expect(refusedFields(BODY, CreateUserDto)).resolves.toEqual([]);
  });

  it('requires all three', async () => {
    await expect(refusedFields({ user_name: 'x' }, CreateUserDto)).resolves.toEqual([
      'user_phone',
      'user_password',
    ]);
  });

  // The house pipe converts a scalar to its text first, so only a list or null is refused here.
  it.each([
    ['a list', [1, 2]],
    ['null', null],
  ])('refuses %s where text is required', async (_label, value) => {
    await expect(refusedFields({ ...BODY, user_password: value }, CreateUserDto)).resolves.toEqual([
      'user_password',
    ]);
  });

  // A body cannot make itself a SUPER ADMIN, or set any column the DTO does not name.
  it.each(['usr_type', 'usrType', 'user_type', 'usr_is_active'])(
    'refuses an unknown field such as %s',
    async (field) => {
      await expect(
        refusedFields({ ...BODY, [field]: 'SUPER ADMIN' }, CreateUserDto),
      ).resolves.toEqual([field]);
    },
  );
});

describe('UpdateUserDto', () => {
  it('lets every field be left out', async () => {
    await expect(refusedFields({ user_phone: '1' }, UpdateUserDto)).resolves.toEqual([]);
  });

  it('still checks the fields it is sent, and refuses unknown ones', async () => {
    await expect(
      refusedFields({ user_name: [7], usr_type: 'SUPER ADMIN' }, UpdateUserDto),
    ).resolves.toEqual(expect.arrayContaining(['user_name', 'usr_type']));
  });
});
