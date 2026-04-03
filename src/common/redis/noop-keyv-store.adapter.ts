import { EventEmitter } from 'node:events';
import { KeyvStoreAdapter, StoredData } from 'keyv';
export class NoopKeyvStoreAdapter extends EventEmitter implements KeyvStoreAdapter {
  public readonly opts = {};
  public namespace?: string;
  async get<Value>(_key: string): Promise<StoredData<Value> | undefined> {
    return undefined;
  }
  async set(_key: string, _value: unknown, _ttl?: number): Promise<boolean> {
    return true;
  }
  async delete(_key: string): Promise<boolean> {
    return true;
  }
  async clear(): Promise<void> {}
}
