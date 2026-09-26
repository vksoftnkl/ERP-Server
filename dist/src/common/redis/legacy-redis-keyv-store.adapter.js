"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyRedisKeyvStoreAdapter = void 0;
const node_events_1 = require("node:events");
const toLegacyRedisTtlSeconds = (ttl) => {
    if (ttl === undefined || ttl === null) {
        return undefined;
    }
    if (ttl <= 0) {
        return 0;
    }
    return Math.ceil(ttl / 1000);
};
class LegacyRedisKeyvStoreAdapter extends node_events_1.EventEmitter {
    store;
    namespacePrefix;
    opts = {};
    namespace;
    constructor(store, namespacePrefix) {
        super();
        this.store = store;
        this.namespacePrefix = namespacePrefix;
    }
    async get(key) {
        const value = await this.store.get(key, undefined, undefined);
        return value ?? undefined;
    }
    async set(key, value, ttl) {
        const legacyTtlSeconds = toLegacyRedisTtlSeconds(ttl);
        if (legacyTtlSeconds === undefined) {
            await this.store.set(key, value, undefined, undefined);
            return true;
        }
        await this.store.set(key, value, { ttl: legacyTtlSeconds }, undefined);
        return true;
    }
    async delete(key) {
        const deletedCount = await this.store.del(key);
        return Number(deletedCount) > 0;
    }
    async clear() {
        const keys = await this.store.keys(`${this.namespacePrefix}*`, undefined);
        if (keys.length === 0) {
            return;
        }
        await this.store.del(keys);
    }
    async disconnect() {
        const client = this.store.getClient();
        if (client?.isOpen && client.quit) {
            await client.quit();
        }
    }
}
exports.LegacyRedisKeyvStoreAdapter = LegacyRedisKeyvStoreAdapter;
//# sourceMappingURL=legacy-redis-keyv-store.adapter.js.map