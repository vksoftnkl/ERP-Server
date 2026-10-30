import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UserType } from '../types/user-administration.enum';
import { SaveUserAdministrationDto } from './save-user-administration.dto';

const dtoOf = (plain: object) =>
  plainToInstance(SaveUserAdministrationDto, { usrLoginName: 'cashier1', ...plain });
const erroredFields = (plain: object): string[] =>
  validateSync(dtoOf(plain)).map((error) => error.property);

describe('SaveUserAdministrationDto', () => {
  it('needs nothing but a login name to validate', () => {
    expect(erroredFields({})).toEqual([]);
    expect(erroredFields({ usrLoginName: '   ' })).toEqual(['usrLoginName']);
  });

  describe('usrPin', () => {
    it.each(['1234', '12345', '123456', ''])('accepts %p', (usrPin) => {
      expect(erroredFields({ usrPin })).toEqual([]);
    });

    it.each(['123', '1234567', '12a4', ' 1234'])('refuses %p', (usrPin) => {
      const [error] = validateSync(dtoOf({ usrPin }));

      expect(error.property).toBe('usrPin');
      expect(Object.values(error.constraints ?? {})).toContain(
        'usrPin must be 4 to 6 digits, or "" to clear it',
      );
    });

    it('lets the key be absent, which keeps the stored PIN', () => {
      expect(dtoOf({}).usrPin).toBeUndefined();
    });
  });

  describe('usrType', () => {
    it('reads an empty string as not sent and keeps null as a clear', () => {
      expect(dtoOf({ usrType: '' }).usrType).toBeUndefined();
      expect(dtoOf({ usrType: null }).usrType).toBeNull();
      expect(erroredFields({ usrType: null })).toEqual([]);
    });

    it('takes the role names in their space spelling', () => {
      expect(erroredFields({ usrType: UserType.STORE_MANAGER })).toEqual([]);
      expect(erroredFields({ usrType: 'STORE_MANAGER' })).toEqual(['usrType']);
      expect(erroredFields({ usrType: 'MANAGER' })).toEqual(['usrType']);
    });
  });

  it('validates each menu grant', () => {
    const [error] = validateSync(
      dtoOf({ menus: [{ umMenuId: 12, umCanPost: true }, { umMenuId: 0 }] }),
    );

    expect(error.property).toBe('menus');
    expect(error.children?.[0].property).toBe('1');
  });

  it('refuses an email that is not one', () => {
    expect(erroredFields({ usrEmail: 'not-an-email' })).toEqual(['usrEmail']);
  });
});
