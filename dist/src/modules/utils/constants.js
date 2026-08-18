"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BigIntUtil = exports.BooleanUtil = exports.DateUtil = exports.StringUtil = exports.NumberUtil = exports.UuidUtil = void 0;
class UuidUtil {
    static toOptional(value) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || undefined;
        }
        return value;
    }
}
exports.UuidUtil = UuidUtil;
class NumberUtil {
    static toOptional(value) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
}
exports.NumberUtil = NumberUtil;
class StringUtil {
    static toNullable(value) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        if (typeof value !== 'string') {
            return value;
        }
        const trimmed = value.trim();
        return trimmed || null;
    }
}
exports.StringUtil = StringUtil;
class DateUtil {
    static toOptionalDate(value) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? undefined : value;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return undefined;
            }
            const parsed = new Date(trimmed);
            return isNaN(parsed.getTime()) ? undefined : parsed;
        }
        return undefined;
    }
}
exports.DateUtil = DateUtil;
class BooleanUtil {
    static toOptional(value) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim().toLowerCase();
            if (trimmed === 'true')
                return true;
            if (trimmed === 'false')
                return false;
            if (trimmed === '1')
                return true;
            if (trimmed === '0')
                return false;
        }
        if (typeof value === 'number') {
            if (value === 1)
                return true;
            if (value === 0)
                return false;
        }
        return undefined;
    }
}
exports.BooleanUtil = BooleanUtil;
class BigIntUtil {
    static toOptional(value) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (typeof value === 'bigint') {
            return value;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? BigInt(value) : undefined;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return undefined;
            }
            if (!/^\d+$/.test(trimmed)) {
                return undefined;
            }
            return BigInt(trimmed);
        }
        return undefined;
    }
}
exports.BigIntUtil = BigIntUtil;
//# sourceMappingURL=constants.js.map