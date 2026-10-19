import { UserLoginSessionsController } from './user-login-sessions.controller';
import { UserLoginSessionsService } from './user-login-sessions.service';
import { UserLoginSessionsPayload } from './types/user-login-sessions-api.types';

const ULS_ID = '019c6f6c-be87-7a11-8905-36092c46f901';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f904';

const PAYLOAD = { ulsId: ULS_ID, ulsUserId: USER_ID } as UserLoginSessionsPayload;
const META = { page: 1, limit: 20, total: 1, total_pages: 1 };

describe('UserLoginSessionsController', () => {
  let service: {
    save: jest.Mock;
    list: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: UserLoginSessionsController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({ items: [PAYLOAD], meta: META }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ ulsId: ULS_ID, deleted: true }),
    };
    controller = new UserLoginSessionsController(service as unknown as UserLoginSessionsService);
  });

  it('words a save without ulsId as a create', async () => {
    await expect(controller.save({ ulsUserId: USER_ID })).resolves.toEqual({
      success: true,
      message: 'User login session created successfully',
      data: PAYLOAD,
    });
  });

  it('words a save with ulsId as an update', async () => {
    await expect(controller.save({ ulsId: ULS_ID, ulsUserId: USER_ID })).resolves.toMatchObject({
      message: 'User login session updated successfully',
    });
  });

  it('lifts the list items and meta into the envelope', async () => {
    await expect(controller.list({})).resolves.toEqual({
      success: true,
      message: 'User login sessions fetched successfully',
      data: [PAYLOAD],
      meta: META,
    });
  });

  it('wraps a single session', async () => {
    await expect(controller.getById(ULS_ID)).resolves.toEqual({
      success: true,
      message: 'User login session fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(ULS_ID)).resolves.toEqual({
      success: true,
      message: 'User login session deleted successfully',
      data: { ulsId: ULS_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(ULS_ID);
  });
});
