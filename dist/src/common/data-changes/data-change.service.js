"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataChangeService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const HEARTBEAT_MS = 25_000;
let DataChangeService = class DataChangeService {
    changes = new rxjs_1.Subject();
    bootId = (0, node_crypto_1.randomUUID)();
    publish(event) {
        this.changes.next(event);
    }
    streamFor(sessionId) {
        const ready = (0, rxjs_1.defer)(() => (0, rxjs_1.of)({ type: 'ready', data: { bootId: this.bootId, at: Date.now() } }));
        const changes = this.changes.pipe((0, rxjs_1.filter)((event) => !sessionId || event.originSessionId !== sessionId), (0, rxjs_1.map)((event) => ({
            type: 'change',
            data: { resource: event.resource, method: event.method, at: event.at },
        })));
        const heartbeat = (0, rxjs_1.interval)(HEARTBEAT_MS).pipe((0, rxjs_1.map)(() => ({ type: 'ping', data: { at: Date.now() } })));
        return (0, rxjs_1.merge)(ready, changes, heartbeat);
    }
};
exports.DataChangeService = DataChangeService;
exports.DataChangeService = DataChangeService = __decorate([
    (0, common_1.Injectable)()
], DataChangeService);
//# sourceMappingURL=data-change.service.js.map