import { EventEmitter } from 'node:events';
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
export declare class LegacyRedisKeyvStoreAdapter extends EventEmitter implements KeyvStoreAdapter {
    private readonly store;
    private readonly namespacePrefix;
    readonly opts: {};
    namespace?: string;
    constructor(store: LegacyRedisStore, namespacePrefix: string);
    get<Value>(key: string): Promise<StoredData<Value> | undefined>;
    set(key: string, value: unknown, ttl?: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    disconnect(): Promise<void>;
}
export {};
