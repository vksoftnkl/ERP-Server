import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { DeviceListMasterController } from './device-list-master.controller';
import { DeviceListMasterService } from './device-list-master.service';
import { DeviceListMasterPayload } from './types/device-list-master-api.types';

const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fc01';

const PAYLOAD = { devId: DEVICE_ID, devDeviceUid: 'DESK-0001' } as DeviceListMasterPayload;
const META = { page: 1, limit: 20, total: 1, total_pages: 1 };

describe('DeviceListMasterController', () => {
  let service: {
    save: jest.Mock;
    list: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: DeviceListMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({ items: [PAYLOAD], meta: META }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ devId: DEVICE_ID, deleted: true }),
    };
    controller = new DeviceListMasterController(service as unknown as DeviceListMasterService);
  });

  it('words a save without devId as a create', async () => {
    const dto = { devDeviceUid: 'DESK-0001' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Device created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with devId as an update', async () => {
    await expect(
      controller.save({ devId: DEVICE_ID, devDeviceUid: 'DESK-0001' }),
    ).resolves.toMatchObject({ message: 'Device updated successfully' });
  });

  it('lifts the list items and meta into the envelope', async () => {
    await expect(controller.list({})).resolves.toEqual({
      success: true,
      message: 'Devices fetched successfully',
      data: [PAYLOAD],
      meta: META,
    });
  });

  it('wraps a single device', async () => {
    await expect(controller.getById(DEVICE_ID)).resolves.toEqual({
      success: true,
      message: 'Device fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(DEVICE_ID)).resolves.toEqual({
      success: true,
      message: 'Device deleted successfully',
      data: { devId: DEVICE_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(DEVICE_ID);
  });

  // Review list 11-19 S1: the whole controller was @Public, so anyone who could reach the
  // server could create, list or delete devices. AccessTokenGuard skips only what carries
  // IS_PUBLIC_KEY, on the class or on the handler.
  it('is not public: no route here skips the login token', () => {
    const reflector = new Reflector();
    // Read off the prototype as plain functions: only their metadata is looked at, never called.
    const proto = DeviceListMasterController.prototype as unknown as Record<
      string,
      (...args: never[]) => unknown
    >;
    const handlers = ['save', 'list', 'getById', 'remove'].map((name) => proto[name]);
    expect(handlers.every(Boolean)).toBe(true);
    for (const handler of handlers) {
      expect(
        reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, DeviceListMasterController]),
      ).toBeFalsy();
    }
  });
});
