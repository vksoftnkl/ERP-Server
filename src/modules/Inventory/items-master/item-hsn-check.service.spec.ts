import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma/prisma.service';
import type { RequestContextService } from 'src/common/request-context/request-context.service';
import type { StatutoryService } from 'src/common/posting/statutory.service';
import type { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import type { AppSettingEffectiveItem } from 'src/modules/settings/appSettings/types/app-settings-api.types';
import { ItemErrorCode } from './types/item-error-codes';
import { ItemHsnCheckService, hsnProblem, resolveHsnCheckMode } from './item-hsn-check.service';
import type { SaveItemCompositeDto } from './dto/save-item-composite.dto';

// Item master review point 1 (2026-11-23): the HSN check on /items/create.
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const setting = (key: string, value: string) => ({ asdKey: key, value }) as unknown as AppSettingEffectiveItem;

describe('resolveHsnCheckMode', () => {
  it('reads OFF / WARN / BLOCK in any case and defaults to WARN', () => {
    expect(resolveHsnCheckMode([setting('inventory.hsn_check', 'block')])).toBe('BLOCK');
    expect(resolveHsnCheckMode([setting('inventory.hsn_check', ' Off ')])).toBe('OFF');
    expect(resolveHsnCheckMode([setting('inventory.hsn_check', 'maybe')])).toBe('WARN');
    expect(resolveHsnCheckMode([])).toBe('WARN');
  });
});

describe('hsnProblem', () => {
  it('a code not in the list is reported first, then a short one', () => {
    expect(hsnProblem('1234', false, 6)?.code).toBe(ItemErrorCode.HSN_NOT_IN_LIST);
    expect(hsnProblem('1006', true, 6)).toMatchObject({
      code: ItemErrorCode.HSN_TOO_SHORT,
      message: 'HSN / SAC 1006 has 4 digits; this company must use at least 6.',
    });
    expect(hsnProblem('100630', true, 6)).toBeNull();
    expect(hsnProblem('1006', true, 0)).toBeNull();
  });
});

describe('ItemHsnCheckService.assertHsn', () => {
  let inList: boolean;
  let mode: string;
  let lawDigits: number | null;
  let ownMin: string;
  let service: ItemHsnCheckService;

  beforeEach(() => {
    inList = true;
    mode = 'WARN';
    lawDigits = 4;
    ownMin = '0';
    const prisma = { $queryRaw: jest.fn(() => Promise.resolve([{ found: inList }])) };
    const requestContext = {
      getCompanyId: () => COMPANY,
      getBranchId: () => null,
      getDeviceId: () => null,
      getUserId: () => null,
    };
    const statutory = { hsnDigits: jest.fn(() => Promise.resolve({ limit: null, digits: lawDigits })) };
    const settings = {
      resolveEffective: jest.fn(() =>
        Promise.resolve([setting('inventory.hsn_check', mode), setting('inventory.hsn_min_length', ownMin)]),
      ),
    };
    service = new ItemHsnCheckService(
      prisma as unknown as PrismaService,
      requestContext as unknown as RequestContextService,
      statutory as unknown as StatutoryService,
      settings as unknown as AppSettingValueService,
    );
  });

  const dto = (extra: Partial<SaveItemCompositeDto> = {}) =>
    ({ item_name_en: 'ZT', item_hsn_code: '9999', ...extra }) as SaveItemCompositeDto;

  const refusal = async (p: Promise<void>) => {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      return ((e as BadRequestException).getResponse() as { errors: Record<string, unknown>[] }).errors[0];
    }
    return null;
  };

  it('a code in the list with enough digits passes', async () => {
    await expect(service.assertHsn(dto({ item_hsn_code: '1006' }))).resolves.toBeUndefined();
  });

  it('WARN: a code not in the list is refused as confirmable, and passes once confirmed', async () => {
    inList = false;
    expect(await refusal(service.assertHsn(dto()))).toMatchObject({
      field: 'item_hsn_code',
      code: 'ITEM_HSN_NOT_IN_LIST',
      confirmable: true,
    });
    await expect(service.assertHsn(dto({ item_hsn_confirmed: true }))).resolves.toBeUndefined();
  });

  it('BLOCK: refused even when confirmed, not confirmable', async () => {
    inList = false;
    mode = 'BLOCK';
    expect(await refusal(service.assertHsn(dto({ item_hsn_confirmed: true })))).toMatchObject({
      code: 'ITEM_HSN_NOT_IN_LIST',
      confirmable: false,
    });
  });

  it('the law digits (6 above Rs 5 crore) or the company minimum, whichever is more', async () => {
    lawDigits = 6;
    expect(await refusal(service.assertHsn(dto({ item_hsn_code: '1006' })))).toMatchObject({
      code: 'ITEM_HSN_TOO_SHORT',
    });
    lawDigits = 4;
    ownMin = '8';
    expect(await refusal(service.assertHsn(dto({ item_hsn_code: '100630' })))).toMatchObject({
      code: 'ITEM_HSN_TOO_SHORT',
    });
  });

  it('OFF, or no code sent: no check', async () => {
    inList = false;
    mode = 'OFF';
    await expect(service.assertHsn(dto())).resolves.toBeUndefined();
    mode = 'BLOCK';
    await expect(service.assertHsn(dto({ item_hsn_code: '' }))).resolves.toBeUndefined();
  });
});
