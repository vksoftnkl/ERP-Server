import { GstProviderAccountService } from '../config/gst-provider-account.service';
import type { GstProviderAccountPayload } from '../types/gst-config.types';
import { GstProviderAccountController } from './gst-provider-account.controller';

const GPA_ID = '019c6f6c-be87-7a11-8905-36092c46e601';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e602';
const PAYLOAD = { gpaId: GPA_ID, hasClientId: true } as GstProviderAccountPayload;

describe('GstProviderAccountController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: GstProviderAccountController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ gpaId: GPA_ID, deleted: true }),
    };
    controller = new GstProviderAccountController(service as unknown as GstProviderAccountService);
  });

  it('words a body without gpaId as a create', async () => {
    const dto = { gpaGpvId: GPV_ID, gpaEnvironment: 'SANDBOX', gpaAccountRef: 'ACC-7' };

    await expect(controller.create(dto)).resolves.toEqual({
      success: true,
      message: 'GST provider account created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a body with gpaId as an update', async () => {
    const dto = { gpaId: GPA_ID, gpaGpvId: GPV_ID, gpaEnvironment: 'SANDBOX', gpaAccountRef: 'A' };

    await expect(controller.create(dto)).resolves.toMatchObject({
      message: 'GST provider account updated successfully',
    });
  });

  it('wraps a get and a delete, each by the id it was sent', async () => {
    await expect(controller.get({ gpaId: GPA_ID })).resolves.toEqual({
      success: true,
      message: 'GST provider account fetched successfully',
      data: PAYLOAD,
    });
    await expect(controller.delete({ gpaId: GPA_ID })).resolves.toEqual({
      success: true,
      message: 'GST provider account deleted successfully',
      data: { gpaId: GPA_ID, deleted: true },
    });
    expect(service.getById).toHaveBeenCalledWith(GPA_ID);
    expect(service.softDelete).toHaveBeenCalledWith(GPA_ID);
  });
});
