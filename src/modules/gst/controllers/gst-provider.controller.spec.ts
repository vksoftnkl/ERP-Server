import { GstProviderService } from '../config/gst-provider.service';
import type { GstProviderPayload } from '../types/gst-config.types';
import { GstProviderController } from './gst-provider.controller';

const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e501';
const PAYLOAD = { gpvId: GPV_ID, gpvCode: 'NIC' } as GstProviderPayload;

describe('GstProviderController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
  };
  let controller: GstProviderController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ gpvId: GPV_ID, deleted: true }),
      restore: jest.fn().mockResolvedValue({ gpvId: GPV_ID, deleted: false }),
    };
    controller = new GstProviderController(service as unknown as GstProviderService);
  });

  it('words a body without gpvId as a create', async () => {
    const dto = { gpvCode: 'NIC', gpvName: 'NIC IRP' };

    await expect(controller.create(dto)).resolves.toEqual({
      success: true,
      message: 'GST provider created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a body with gpvId as an update', async () => {
    const dto = { gpvId: GPV_ID, gpvCode: 'NIC', gpvName: 'NIC IRP' };

    await expect(controller.create(dto)).resolves.toMatchObject({
      message: 'GST provider updated successfully',
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('wraps a get, a delete and a restore, each by the id it was sent', async () => {
    await expect(controller.get({ gpvId: GPV_ID })).resolves.toEqual({
      success: true,
      message: 'GST provider fetched successfully',
      data: PAYLOAD,
    });
    await expect(controller.delete({ gpvId: GPV_ID })).resolves.toEqual({
      success: true,
      message: 'GST provider deleted successfully',
      data: { gpvId: GPV_ID, deleted: true },
    });
    await expect(controller.restore({ gpvId: GPV_ID })).resolves.toEqual({
      success: true,
      message: 'GST provider restored successfully',
      data: { gpvId: GPV_ID, deleted: false },
    });
    expect(service.getById).toHaveBeenCalledWith(GPV_ID);
    expect(service.softDelete).toHaveBeenCalledWith(GPV_ID);
    expect(service.restore).toHaveBeenCalledWith(GPV_ID);
  });
});
