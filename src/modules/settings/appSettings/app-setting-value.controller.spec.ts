import { AppSettingValueController } from './app-setting-value.controller';
import { AppSettingValueService } from './app-setting-value.service';
import { AppSettingScope, AppSettingValuePayload } from './types/app-settings-api.types';

const ASV_ID = '019c6f6c-be87-7a11-8905-36092c46f205';
const PAYLOAD = { asvId: ASV_ID, asvSettingKey: 'sales.max_discount_percent' } as AppSettingValuePayload;

describe('AppSettingValueController', () => {
  let service: { save: jest.Mock; resolveEffective: jest.Mock; softDelete: jest.Mock };
  let controller: AppSettingValueController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue([PAYLOAD]),
      resolveEffective: jest.fn().mockResolvedValue([{ asdKey: 'sales.max_discount_percent' }]),
      softDelete: jest
        .fn()
        .mockResolvedValue({ asvId: ASV_ID, asvSettingKey: 'sales.max_discount_percent', deleted: true }),
    };
    controller = new AppSettingValueController(service as unknown as AppSettingValueService);
  });

  it('hands the service the data array of the body and wraps what it saved', async () => {
    const data = [{ asvSettingKey: 'sales.max_discount_percent', asvScope: AppSettingScope.GLOBAL }];

    await expect(controller.save({ data })).resolves.toEqual({
      success: true,
      message: 'Overrides saved successfully',
      data: [PAYLOAD],
    });
    expect(service.save).toHaveBeenCalledWith(data);
  });

  it('wraps the effective settings for the caller', async () => {
    const query = { companyId: '019c6f6c-be87-7a11-8905-36092c46f202' };

    await expect(controller.effective(query)).resolves.toEqual({
      success: true,
      message: 'Settings fetched successfully',
      data: [{ asdKey: 'sales.max_discount_percent' }],
    });
    expect(service.resolveEffective).toHaveBeenCalledWith(query);
  });

  it('words a delete as a reset', async () => {
    await expect(controller.remove(ASV_ID)).resolves.toEqual({
      success: true,
      message: 'Override reset successfully',
      data: { asvId: ASV_ID, asvSettingKey: 'sales.max_discount_percent', deleted: true },
    });
  });
});
