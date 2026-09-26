import { EventEmitter } from 'node:events';
import { KeyvStoreAdapter, StoredData } from 'keyv';
export declare class NoopKeyvStoreAdapter extends EventEmitter implements KeyvStoreAdapter {
    readonly opts: {};
    namespace?: string;
    get<Value>(): Promise<StoredData<Value> | undefined>;
    set(): Promise<boolean>;
    delete(): Promise<boolean>;
    clear(): Promise<void>;
}
