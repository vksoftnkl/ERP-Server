import { EventEmitter } from 'node:events';
import { redisStore } from 'cache-manager-redis-store';
import { KeyvStoreAdapter, StoredData } from 'keyv';
type LegacyRedisStore = {
  get(key: string, options?: unknown, cb?: unknown): Promise<unknown>;
  set(key: string, value: unknown, options?: unknown, cb?: unknown): Promise<unknown>;
  del(...args: unknown[]): Promise<unknown>;
  keys(pattern: string, cb?: unknown): Promise<string[]>;
  getClient(): {
    isOpen?: boolean;
    quit?: () => Promise<string | void>;
  };
};
const toLegacyRedisTtlSeconds = (ttl?: number): number | undefined => {
  if (ttl === undefined || ttl === null) {
    return undefined;
  }
  if (ttl <= 0) {
    return 0;
  }
  return Math.ceil(ttl / 1000);
};
export class LegacyRedisKeyvStoreAdapter extends EventEmitter implements KeyvStoreAdapter {
  public readonly opts = {};
  public namespace?: string;
  constructor(
    private readonly store: LegacyRedisStore,
    private readonly namespacePrefix: string,
  ) {
    super();
  }
  async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    const value = await this.store.get(key, undefined, undefined);
    return value ?? undefined;
  }
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const legacyTtlSeconds = toLegacyRedisTtlSeconds(ttl);
    if (legacyTtlSeconds === undefined) {
      await this.store.set(key, value, undefined, undefined);
      return true;
    }
    await this.store.set(key, value, { ttl: legacyTtlSeconds }, undefined);
    return true;
  }
  async delete(key: string): Promise<boolean> {
    const deletedCount = await this.store.del(key);
    return Number(deletedCount) > 0;
  }
  async clear(): Promise<void> {
    const keys = await this.store.keys(`${this.namespacePrefix}*`, undefined);
    if (keys.length === 0) {
      return;
    }
    await this.store.del(keys);
  }
  async disconnect(): Promise<void> {
    const client = this.store.getClient();
    if (client?.isOpen && client.quit) {
      await client.quit();
    }
  }
}
