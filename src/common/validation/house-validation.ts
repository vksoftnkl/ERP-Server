import {
  BadRequestException,
  ValidationPipe,
  type ValidationError,
  type ValidationPipeOptions,
} from '@nestjs/common';

/**
 * Notes 119 §4 — a body or query that fails its DTO answers in the house error
 * shape, one error per field, each with a `code` the client switches on:
 *
 *   { "success": false, "message": "Validation failed",
 *     "errors": [ { "field": "sbSessionId", "code": "VALIDATION_IS_UUID",
 *                   "message": "sbSessionId must be a UUID" } ] }
 *
 * `code` = VALIDATION_ + the class-validator constraint in upper snake case
 * (isNotEmpty → VALIDATION_IS_NOT_EMPTY, isUuid → VALIDATION_IS_UUID); an
 * unknown property (forbidNonWhitelisted) is VALIDATION_WHITELIST. A nested
 * DTO's field is its path: `lines.0.qty`. Before notes 119 Nest answered
 * `message: [...]` with no field and no code.
 */
export interface ValidationErrorDetail {
  field: string;
  code: string;
  message: string;
}

/** The pipe options every entry point shares: main.ts, the e2e apps, validateDto. */
export const HOUSE_VALIDATION_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
};

/** Constraint names whose upper-snake form would not say what the client needs. */
const CONSTRAINT_CODES: Readonly<Record<string, string>> = {
  whitelistValidation: 'VALIDATION_WHITELIST',
};

/** isNotEmpty → VALIDATION_IS_NOT_EMPTY; isISO8601 → VALIDATION_IS_ISO8601. */
export function validationCode(constraint: string): string {
  return (
    CONSTRAINT_CODES[constraint] ??
    `VALIDATION_${constraint
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()}`
  );
}

/**
 * class-validator's tree, flattened: one detail per field that failed (its
 * first constraint), nested DTOs and arrays by their dotted path.
 */
export function validationErrorDetails(
  errors: readonly ValidationError[],
  parent = '',
): ValidationErrorDetail[] {
  const out: ValidationErrorDetail[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const constraints = Object.entries(error.constraints ?? {});
    if (constraints.length > 0) {
      const [name, message] = constraints[0];
      out.push({ field, code: validationCode(name), message });
    }
    if (error.children && error.children.length > 0) {
      out.push(...validationErrorDetails(error.children, field));
    }
  }
  return out;
}

/**
 * A 400 that did not come through the house pipe — Nest's ParseUUIDPipe /
 * ParseIntPipe … on a route parameter ("Validation failed (uuid is expected)"),
 * or an old `{ message: [...] }` list — gets the nearest code. The pipes'
 * sentences are the framework's own and fixed; anything else is
 * VALIDATION_FAILED: the request did not validate.
 */
export function frameworkValidationCode(message: string): string {
  if (/should not exist$/.test(message)) {
    return 'VALIDATION_WHITELIST';
  }
  const expected = /^Validation failed \((.+) is expected\)$/.exec(message)?.[1] ?? '';
  if (/^uuid\b/.test(expected)) {
    return 'VALIDATION_IS_UUID';
  }
  if (/^numeric string\b/.test(expected)) {
    return 'VALIDATION_IS_INT';
  }
  if (/^(boolean string)\b/.test(expected)) {
    return 'VALIDATION_IS_BOOLEAN';
  }
  if (/^enum string\b/.test(expected)) {
    return 'VALIDATION_IS_ENUM';
  }
  if (/^(float|numeric)\b/.test(expected)) {
    return 'VALIDATION_IS_NUMBER';
  }
  return 'VALIDATION_FAILED';
}

export function houseValidationException(errors: ValidationError[]): BadRequestException {
  const details = validationErrorDetails(errors);
  // The house body, built here rather than through module-shared.utils, which
  // imports frameworkValidationCode from this file.
  return new BadRequestException({
    success: false,
    message: 'Validation failed',
    errors:
      details.length > 0
        ? details
        : [{ field: 'request', code: 'VALIDATION_FAILED', message: 'Validation failed' }],
  });
}

/** The global pipe (main.ts) and every place that validates a DTO by hand. */
export function createHouseValidationPipe(
  overrides: Partial<ValidationPipeOptions> = {},
): ValidationPipe {
  return new ValidationPipe({
    ...HOUSE_VALIDATION_OPTIONS,
    exceptionFactory: houseValidationException,
    ...overrides,
  });
}
