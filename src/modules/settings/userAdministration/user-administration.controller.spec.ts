import { UserAdministrationController } from './user-administration.controller';
import { UserAdministrationService } from './user-administration.service';
import { UserAdminPayload } from './types/user-administration-api.types';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f102';
const PAYLOAD = { usrId: USER_ID, usrLoginName: 'cashier1', menus: [] } as unknown as UserAdminPayload;

describe('UserAdministrationController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: UserAdministrationController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ usrId: USER_ID, deleted: true }),
    };
    controller = new UserAdministrationController(service as unknown as UserAdministrationService);
  });

  it('words a save without usrId as a create', async () => {
    const dto = { usrLoginName: 'cashier1', usrPassword: 'secret1' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'User created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with usrId as an update', async () => {
    await expect(
      controller.save({ usrId: USER_ID, usrLoginName: 'cashier1' }),
    ).resolves.toMatchObject({ message: 'User updated successfully' });
  });

  it('wraps a single user', async () => {
    await expect(controller.getById(USER_ID)).resolves.toEqual({
      success: true,
      message: 'User fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(USER_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(USER_ID)).resolves.toEqual({
      success: true,
      message: 'User deleted successfully',
      data: { usrId: USER_ID, deleted: true },
    });
  });
});
