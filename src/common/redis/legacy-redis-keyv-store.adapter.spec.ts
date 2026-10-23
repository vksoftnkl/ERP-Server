import { LegacyRedisKeyvStoreAdapter } from './legacy-redis-keyv-store.adapter';

describe('LegacyRedisKeyvStoreAdapter', () => {
  let client: { isOpen?: boolean; quit?: jest.Mock };
  let store: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
    getClient: jest.Mock;
  };
  let adapter: LegacyRedisKeyvStoreAdapter;

  beforeEach(() => {
    client = { isOpen: true, quit: jest.fn(async () => 'OK') };
    store = {
      get: jest.fn(async () => undefined),
      set: jest.fn(async () => 'OK'),
      del: jest.fn(async () => 1),
      keys: jest.fn(async () => []),
      getClient: jest.fn(() => client),
    };
    adapter = new LegacyRedisKeyvStoreAdapter(store, 'erp:');
  });

  describe('get', () => {
    it('returns the stored value', async () => {
      store.get.mockResolvedValue({ a: 1 });

      await expect(adapter.get('k')).resolves.toEqual({ a: 1 });
      expect(store.get).toHaveBeenCalledWith('k', undefined, undefined);
    });

    it('turns a redis null into undefined', async () => {
      store.get.mockResolvedValue(null);

      await expect(adapter.get('k')).resolves.toBeUndefined();
    });
  });

  describe('set', () => {
    it('stores without a ttl when none is given', async () => {
      await expect(adapter.set('k', 'v')).resolves.toBe(true);

      expect(store.set).toHaveBeenCalledWith('k', 'v', undefined, undefined);
    });

    it('converts the keyv ttl (ms) to whole seconds, rounding up', async () => {
      await adapter.set('k', 'v', 30_000);
      await adapter.set('k', 'v', 1_001);
      await adapter.set('k', 'v', 1);

      expect(store.set.mock.calls.map((c) => c[2])).toEqual([{ ttl: 30 }, { ttl: 2 }, { ttl: 1 }]);
    });

    it('passes a zero or negative ttl as 0', async () => {
      await adapter.set('k', 'v', 0);
      await adapter.set('k', 'v', -5);

      expect(store.set.mock.calls.map((c) => c[2])).toEqual([{ ttl: 0 }, { ttl: 0 }]);
    });
  });

  describe('delete', () => {
    it('is true when a key went', async () => {
      await expect(adapter.delete('k')).resolves.toBe(true);
      expect(store.del).toHaveBeenCalledWith('k');
    });

    it('is false when there was nothing to delete', async () => {
      store.del.mockResolvedValue(0);

      await expect(adapter.delete('k')).resolves.toBe(false);
    });
  });

  describe('clear', () => {
    it('deletes every key under the namespace prefix in one call', async () => {
      store.keys.mockResolvedValue(['erp:a', 'erp:b']);

      await adapter.clear();

      expect(store.keys).toHaveBeenCalledWith('erp:*', undefined);
      expect(store.del).toHaveBeenCalledWith(['erp:a', 'erp:b']);
    });

    it('does not call del with an empty list', async () => {
      await adapter.clear();

      expect(store.del).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('quits an open client', async () => {
      await adapter.disconnect();

      expect(client.quit).toHaveBeenCalledTimes(1);
    });

    it('leaves a closed client alone', async () => {
      client.isOpen = false;

      await adapter.disconnect();

      expect(client.quit).not.toHaveBeenCalled();
    });

    it('copes with a client that has no quit', async () => {
      delete client.quit;

      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });
});
