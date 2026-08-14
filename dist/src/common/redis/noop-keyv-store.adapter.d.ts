import { EventEmitter } from 'node:events';
import { KeyvStoreAdapter, StoredData } from 'keyv';
export declare class NoopKeyvStoreAdapter extends EventEmitter implements KeyvStoreAdapter {
    readonly opts: {};
    namespace?: string;
    get<Value>(_key: string): Promise<StoredData<Value> | undefined>;
    set(_key: string, _value: unknown, _ttl?: number): Promise<boolean>;
    delete(_key: string): Promise<boolean>;
    clear(): Promise<void>;
}
