export const toOptionalUuid = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return value as string;
};

export const toTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value as string;
  }
  return value.trim();
};

export const toNullableUuid = (value: unknown): string | null | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return value as string;
};

export const toNullableString = (value: unknown): string | null | undefined => {
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
};

export const toOptionalInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : (value as number);
};

export const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

export const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return value as boolean;
};

export const resolveAliasValue = (
  value: unknown,
  obj: unknown,
  aliases: string[],
): unknown => {
  if (value !== undefined) {
    return value;
  }
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }
  const source = obj as Record<string, unknown>;
  for (const alias of aliases) {
    const aliasValue = source[alias];
    if (aliasValue !== undefined) {
      return aliasValue;
    }
  }
  return undefined;
};
