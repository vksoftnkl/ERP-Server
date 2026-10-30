import { MenuMasterController } from './menu-master.controller';
import { MenuMasterService } from './menu-master.service';
import { MenuMasterPayload } from './types/menu-master-api.types';

const ITEM = { menuId: 1, menuName: 'Masters' } as MenuMasterPayload;

describe('MenuMasterController', () => {
  let service: { get: jest.Mock; getUserMenu: jest.Mock; updateVisibility: jest.Mock };
  let controller: MenuMasterController;

  beforeEach(() => {
    service = {
      get: jest.fn().mockResolvedValue({ items: [ITEM], meta: { visibleOnly: false, count: 1 } }),
      getUserMenu: jest
        .fn()
        .mockResolvedValue({ items: [ITEM], meta: { visibleOnly: true, count: 1 } }),
      updateVisibility: jest.fn().mockResolvedValue([{ menuId: 1, menuVisibility: false }]),
    };
    controller = new MenuMasterController(service as unknown as MenuMasterService);
  });

  it('wraps the menu tree', async () => {
    await expect(controller.get({ visibleOnly: false })).resolves.toEqual({
      success: true,
      message: 'Menus fetched successfully',
      data: [ITEM],
      meta: { visibleOnly: false, count: 1 },
    });
    expect(service.get).toHaveBeenCalledWith({ visibleOnly: false });
  });

  it('wraps the current user menu', async () => {
    await expect(controller.getUserMenu()).resolves.toEqual({
      success: true,
      message: 'User menus fetched successfully',
      data: [ITEM],
      meta: { visibleOnly: true, count: 1 },
    });
  });

  it('hands the service the menus array of the body, not the body', async () => {
    const menus = [{ menuId: 1, menuVisibility: false }];

    await expect(controller.updateVisibility({ menus })).resolves.toEqual({
      success: true,
      message: 'Menu visibility updated successfully',
      data: [{ menuId: 1, menuVisibility: false }],
    });
    expect(service.updateVisibility).toHaveBeenCalledWith(menus);
  });
});
