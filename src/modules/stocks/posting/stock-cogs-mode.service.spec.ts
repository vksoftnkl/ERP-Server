import type { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { StockCogsModeService } from './stock-cogs-mode.service';

const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BRANCH_ID = '33333333-3333-4333-8333-333333333333';

describe('StockCogsModeService', () => {
  let resolveEffective: jest.Mock;
  let service: StockCogsModeService;

  const settingsWith = (items: Array<{ asdKey: string; value: string | null }>) =>
    resolveEffective.mockResolvedValue(items);

  beforeEach(() => {
    resolveEffective = jest.fn().mockResolvedValue([]);
    service = new StockCogsModeService({ resolveEffective } as unknown as AppSettingValueService);
  });

  it('reads accounts.cogs_mode for the company and branch, with no device or user', async () => {
    await service.cogsMode(COMPANY_ID, BRANCH_ID);

    expect(resolveEffective).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      deviceId: null,
      userId: null,
    });
  });

  it.each(['PERIODIC', 'periodic', '  Periodic  '])('answers PERIODIC for %p', async (value) => {
    settingsWith([{ asdKey: 'accounts.cogs_mode', value }]);

    await expect(service.cogsMode(COMPANY_ID, BRANCH_ID)).resolves.toBe('PERIODIC');
  });

  it.each([
    ['set to PERPETUAL', [{ asdKey: 'accounts.cogs_mode', value: 'PERPETUAL' }]],
    ['set to something else', [{ asdKey: 'accounts.cogs_mode', value: 'FIFO' }]],
    ['blank', [{ asdKey: 'accounts.cogs_mode', value: '   ' }]],
    ['null', [{ asdKey: 'accounts.cogs_mode', value: null }]],
    ['not set at all', [{ asdKey: 'sales.round_off', value: 'PERIODIC' }]],
  ])('defaults to PERPETUAL when the setting is %s', async (_label, items) => {
    settingsWith(items);

    await expect(service.cogsMode(COMPANY_ID, BRANCH_ID)).resolves.toBe('PERPETUAL');
  });
});
