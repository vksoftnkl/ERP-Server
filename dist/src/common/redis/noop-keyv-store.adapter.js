"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopKeyvStoreAdapter = void 0;
const node_events_1 = require("node:events");
class NoopKeyvStoreAdapter extends node_events_1.EventEmitter {
    opts = {};
    namespace;
    async get(_key) {
        return undefined;
    }
    async set(_key, _value, _ttl) {
        return true;
    }
    async delete(_key) {
        return true;
    }
    async clear() { }
}
exports.NoopKeyvStoreAdapter = NoopKeyvStoreAdapter;
//# sourceMappingURL=noop-keyv-store.adapter.js.map