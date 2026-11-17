"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockSummaryRunStore = exports.RUN_ROW_CAP_TOTAL = exports.RUN_CAP_TOTAL = exports.RUN_CAP_PER_USER = exports.RUN_IDLE_MS = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
exports.RUN_IDLE_MS = 15 * 60_000;
exports.RUN_CAP_PER_USER = 4;
exports.RUN_CAP_TOTAL = 40;
exports.RUN_ROW_CAP_TOTAL = 100_000;
let StockSummaryRunStore = class StockSummaryRunStore {
    runs = new Map();
    now = () => Date.now();
    idleMs = exports.RUN_IDLE_MS;
    put(userId, companyId, data) {
        this.sweep();
        const t = this.now();
        const run = {
            ...data,
            runId: (0, node_crypto_1.randomUUID)(),
            userId,
            companyId,
            createdAt: t,
            lastUsed: t,
        };
        this.runs.set(run.runId, run);
        this.enforceCaps(userId);
        return run;
    }
    get(runId, userId, opts = {}) {
        const run = this.runs.get(runId);
        if (!run)
            return null;
        if (this.now() - run.lastUsed > this.idleMs) {
            this.runs.delete(runId);
            return null;
        }
        if (run.userId !== userId)
            return null;
        if (opts.companyId && opts.companyId !== run.companyId)
            return null;
        if (opts.kind && opts.kind !== run.kind)
            return null;
        run.lastUsed = this.now();
        return run;
    }
    expiresAt(run) {
        return run.lastUsed + this.idleMs;
    }
    size() {
        let rows = 0;
        for (const r of this.runs.values())
            rows += r.rows.length;
        return { runs: this.runs.size, rows };
    }
    sweep() {
        const t = this.now();
        for (const [id, r] of this.runs) {
            if (t - r.lastUsed > this.idleMs)
                this.runs.delete(id);
        }
    }
    enforceCaps(userId) {
        const byAge = (a, b) => a.lastUsed - b.lastUsed || a.createdAt - b.createdAt;
        const mine = [...this.runs.values()].filter((r) => r.userId === userId).sort(byAge);
        while (mine.length > exports.RUN_CAP_PER_USER) {
            const gone = mine.shift();
            if (gone)
                this.runs.delete(gone.runId);
        }
        const all = [...this.runs.values()].sort(byAge);
        let rows = all.reduce((s, r) => s + r.rows.length, 0);
        while (all.length > 1 && (all.length > exports.RUN_CAP_TOTAL || rows > exports.RUN_ROW_CAP_TOTAL)) {
            const gone = all.shift();
            if (!gone)
                break;
            rows -= gone.rows.length;
            this.runs.delete(gone.runId);
        }
    }
};
exports.StockSummaryRunStore = StockSummaryRunStore;
exports.StockSummaryRunStore = StockSummaryRunStore = __decorate([
    (0, common_1.Injectable)()
], StockSummaryRunStore);
//# sourceMappingURL=stock-summary-run.store.js.map