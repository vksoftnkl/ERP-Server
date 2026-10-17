/**
 * `unknown` → text, without the `[object Object]` trap.
 *
 * Three places in the render path have to turn a value of unknown type into a
 * string, and a bare `String(value)` is wrong in each for the same reason:
 *
 *   * a LINK KEY built from a row's column — if the column holds a json value,
 *     `String()` makes every row's key '[object Object]' and the nesting
 *     silently groups every child under one parent;
 *   * an ERROR MESSAGE quoting a value the operator sent — '[object Object]'
 *     tells them nothing about what they typed;
 *   * a TEXT-typed column falling through coercion, where the same applies.
 *
 * A json value keeps its json form here, which is at least readable, sorts
 * consistently and distinguishes one object from another.
 */
export function toScalarText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    // A circular structure cannot come from a driver row or a JSON request
    // body, but a provider is ordinary code and could hand one over.
    return '[unprintable]';
  }
}
