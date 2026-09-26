"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGroupPath = exports.GROUP_PATH_SEPARATOR = exports.PageAggregates = exports.PrecomputedAggregates = exports.readAccumulator = exports.accumulate = exports.emptyAccumulator = void 0;
const emptyAccumulator = () => ({
    sum: 0,
    count: 0,
    valueCount: 0,
    min: null,
    max: null,
});
exports.emptyAccumulator = emptyAccumulator;
const accumulate = (accumulator, value) => {
    accumulator.count += 1;
    if (value === null || !Number.isFinite(value)) {
        return;
    }
    accumulator.valueCount += 1;
    accumulator.sum += value;
    accumulator.min = accumulator.min === null ? value : Math.min(accumulator.min, value);
    accumulator.max = accumulator.max === null ? value : Math.max(accumulator.max, value);
};
exports.accumulate = accumulate;
const readAccumulator = (accumulator, fn) => {
    if (!accumulator) {
        return 0;
    }
    switch (fn) {
        case 'sum':
            return accumulator.sum;
        case 'count':
            return accumulator.count;
        case 'avg':
            return accumulator.valueCount === 0 ? 0 : accumulator.sum / accumulator.valueCount;
        case 'min':
            return accumulator.min ?? 0;
        case 'max':
            return accumulator.max ?? 0;
        default:
            return 0;
    }
};
exports.readAccumulator = readAccumulator;
class PrecomputedAggregates {
    report = new Map();
    groups = new Map();
    addReport(key, value) {
        let accumulator = this.report.get(key);
        if (!accumulator) {
            accumulator = (0, exports.emptyAccumulator)();
            this.report.set(key, accumulator);
        }
        (0, exports.accumulate)(accumulator, value);
    }
    addGroup(groupPath, key, value) {
        let groupBucket = this.groups.get(groupPath);
        if (!groupBucket) {
            groupBucket = new Map();
            this.groups.set(groupPath, groupBucket);
        }
        let accumulator = groupBucket.get(key);
        if (!accumulator) {
            accumulator = (0, exports.emptyAccumulator)();
            groupBucket.set(key, accumulator);
        }
        (0, exports.accumulate)(accumulator, value);
    }
    readReport(key, fn) {
        return (0, exports.readAccumulator)(this.report.get(key), fn);
    }
    readGroup(groupPath, key, fn) {
        return (0, exports.readAccumulator)(this.groups.get(groupPath)?.get(key), fn);
    }
}
exports.PrecomputedAggregates = PrecomputedAggregates;
class PageAggregates {
    accumulators = new Map();
    add(key, value) {
        let accumulator = this.accumulators.get(key);
        if (!accumulator) {
            accumulator = (0, exports.emptyAccumulator)();
            this.accumulators.set(key, accumulator);
        }
        (0, exports.accumulate)(accumulator, value);
    }
    read(key, fn) {
        return (0, exports.readAccumulator)(this.accumulators.get(key), fn);
    }
    reset() {
        this.accumulators = new Map();
    }
}
exports.PageAggregates = PageAggregates;
exports.GROUP_PATH_SEPARATOR = '\u001F';
const buildGroupPath = (keys) => keys.join(exports.GROUP_PATH_SEPARATOR);
exports.buildGroupPath = buildGroupPath;
//# sourceMappingURL=aggregate.accumulator.js.map