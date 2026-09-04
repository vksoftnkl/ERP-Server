export class UuidUtil {
  static toOptional(value: string): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || undefined;
    }

    return value as string;
  }
}

export class NumberUtil {
  static toOptional(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}

// src/common/utils/string.util.ts

export class StringUtil {
  static toNullable(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value as string;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }
}

// src/common/utils/date.util.ts

export class DateUtil {
  static toOptionalDate(value: unknown): Date | undefined {
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

// src/common/utils/boolean.util.ts

export class BooleanUtil {
  static toOptional(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();

      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      if (trimmed === '1') return true;
      if (trimmed === '0') return false;
    }

    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    return undefined;
  }
}

// src/common/utils/bigint.util.ts

export class BigIntUtil {
  static toOptional(value: unknown): bigint | undefined {
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