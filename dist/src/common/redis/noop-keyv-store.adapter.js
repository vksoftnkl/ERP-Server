"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopKeyvStoreAdapter = void 0;
const node_events_1 = require("node:events");
class NoopKeyvStoreAdapter extends node_events_1.EventEmitter {
    opts = {};
    namespace;
    get() {
        return Promise.resolve(undefined);
    }
    set() {
        return Promise.resolve(true);
    }
    delete() {
        return Promise.resolve(true);
    }
    clear() {
        return Promise.resolve();
    }
}
exports.NoopKeyvStoreAdapter = NoopKeyvStoreAdapter;
//# sourceMappingURL=noop-keyv-store.adapter.js.map