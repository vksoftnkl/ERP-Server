import { isEmptyShortName, shortNameFromName } from './short-from-name';
import { ITEM_BRAND_SHORT_SERIES } from 'src/modules/settings/shared/code-series-lock';
import type { ModuleWriteClient } from 'src/common/utils/module-shared.utils';

/** Inventory masters review (user, 20/11/2026): a blank Short Name is made from the name. */
describe('short-from-name', () => {
  const tx = () => ({ $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]) });

  it('empty = null or spaces; left out (undefined) is not empty', () => {
    expect(isEmptyShortName(null)).toBe(true);
    expect(isEmptyShortName('   ')).toBe(true);
    expect(isEmptyShortName('')).toBe(true);
    expect(isEmptyShortName(undefined)).toBe(false);
    expect(isEmptyShortName('AB')).toBe(false);
  });

  it('initials 3 to 6 by the Company rule, under the series lock', async () => {
    const client = tx();
    const taken = jest.fn().mockResolvedValue([]);
    await expect(
      shortNameFromName(client as unknown as ModuleWriteClient, ITEM_BRAND_SHORT_SERIES, 'Zt Fresh Vegetables', taken),
    ).resolves.toBe('ZFV');
    expect(taken).toHaveBeenCalledWith('ZFV');
    expect(client.$queryRaw.mock.calls[0].slice(1)).toEqual(['inventory.item_brand_master', 'brand_short']);
    // Padded from the first word; skip words left out; at most 6.
    await expect(
      shortNameFromName(client as unknown as ModuleWriteClient, ITEM_BRAND_SHORT_SERIES, 'Amul', taken),
    ).resolves.toBe('AMU');
    await expect(
      shortNameFromName(client as unknown as ModuleWriteClient, ITEM_BRAND_SHORT_SERIES, 'The Sugi Traders Pvt Ltd', taken),
    ).resolves.toBe('STU');
    await expect(
      shortNameFromName(client as unknown as ModuleWriteClient, ITEM_BRAND_SHORT_SERIES, 'a b c d e f g h', taken),
    ).resolves.toBe('ABCDEF');
  });

  it('a clash, any case, takes the first free number', async () => {
    const taken = jest.fn().mockResolvedValue(['zfv', 'ZFV2', null]);
    await expect(
      shortNameFromName(tx() as unknown as ModuleWriteClient, ITEM_BRAND_SHORT_SERIES, 'Zt Fresh Vegetables', taken),
    ).resolves.toBe('ZFV3');
  });

  it('a name with no letter or digit makes none, and takes no lock', async () => {
    const client = tx();
    const taken = jest.fn();
    await expect(
      shortNameFromName(client as unknown as ModuleWriteClient, ITEM_BRAND_SHORT_SERIES, '--', taken),
    ).resolves.toBeNull();
    expect(client.$queryRaw).not.toHaveBeenCalled();
    expect(taken).not.toHaveBeenCalled();
  });
});
