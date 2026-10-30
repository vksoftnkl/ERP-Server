import { EventEmitter } from 'node:events';
import { KeyvStoreAdapter, StoredData } from 'keyv';
export class NoopKeyvStoreAdapter extends EventEmitter implements KeyvStoreAdapter {
  public readonly opts = {};
  public namespace?: string;
  get<Value>(): Promise<StoredData<Value> | undefined> {
    return Promise.resolve(undefined);
  }
  set(): Promise<boolean> {
    return Promise.resolve(true);
  }
  delete(): Promise<boolean> {
    return Promise.resolve(true);
  }
  clear(): Promise<void> {
    return Promise.resolve();
  }
}
