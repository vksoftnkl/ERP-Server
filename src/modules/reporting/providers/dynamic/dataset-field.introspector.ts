import { FieldDef } from 'pg';
import { FieldMeta, FieldType, ReportRow } from '../report-data-provider.types';

/**
 * Turn a query's pg field descriptors into the FieldMeta the designer needs.
 *
 * Field metadata is INTROSPECTED rather than hand-typed for a plain reason: an
 * author who has to retype every column as JSON will get one wrong, and a
 * mistyped field is not a validation error — it is an invoice where a money
 * column right-aligns as text and foots to nothing. Postgres already knows the
 * types. Asking it is both cheaper and correct.
 */

/** pg type OIDs. Only the ones a report column can plausibly be. */
const OID_TO_FIELD_TYPE: ReadonlyMap<number, FieldType> = new Map<number, FieldType>([
  [16, 'boolean'], // bool
  [20, 'integer'], // int8
  [21, 'integer'], // int2
  [23, 'integer'], // int4
  [26, 'integer'], // oid
  [700, 'number'], // float4
  [701, 'number'], // float8
  [790, 'number'], // money
  [1700, 'number'], // numeric
  [1082, 'date'], // date
  [1114, 'datetime'], // timestamp
  [1184, 'datetime'], // timestamptz
  [114, 'object'], // json
  [3802, 'object'], // jsonb
]);

/** Sensible default patterns, so the designer pre-fills something usable. */
const DEFAULT_FORMAT: Partial<Record<FieldType, string>> = {
  number: '#,##0.00',
  date: 'dd-MM-yyyy',
  datetime: 'dd-MM-yyyy HH:mm',
};

/**
 * `qty_on_hand` → `Qty on hand`. A label the author can overwrite, not one they
 * have to supply before the dataset works at all.
 */
export const humaniseColumnName = (name: string): string => {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (spaced === '') {
    return name;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

export const fieldTypeForOid = (dataTypeId: number): FieldType =>
  OID_TO_FIELD_TYPE.get(dataTypeId) ?? 'string';

/**
 * Build FieldMeta from the descriptors of a probe query.
 *
 * Duplicate output names are dropped rather than merged: `SELECT a.id, b.id`
 * produces two columns called `id`, and a template referencing `row.id` would
 * silently get whichever the driver wrote last. Failing the save with a clear
 * message is the better outcome, so the caller checks for the drop.
 */
export const introspectFields = (
  descriptors: readonly FieldDef[],
  overrides: readonly FieldMeta[] = [],
): FieldMeta[] => {
  const overrideByName = new Map(overrides.map((field) => [field.name, field]));
  const seen = new Set<string>();
  const fields: FieldMeta[] = [];

  for (const descriptor of descriptors) {
    if (seen.has(descriptor.name)) {
      continue;
    }
    seen.add(descriptor.name);

    const type = fieldTypeForOid(descriptor.dataTypeID);
    const override = overrideByName.get(descriptor.name);

    fields.push({
      name: descriptor.name,
      // The author may relabel or reformat a column, but never retype it —
      // the type is a fact about the query, not a preference.
      type,
      label: override?.label ?? humaniseColumnName(descriptor.name),
      ...(override?.format ?? DEFAULT_FORMAT[type]
        ? { format: override?.format ?? DEFAULT_FORMAT[type] }
        : {}),
      ...(override?.complexScript ? { complexScript: true } : {}),
      ...(override?.description ? { description: override.description } : {}),
    });
  }

  return fields;
};

/** Output names that appeared more than once — a save-blocking ambiguity. */
export const findDuplicateColumns = (descriptors: readonly FieldDef[]): string[] => {
  const counts = new Map<string, number>();
  for (const descriptor of descriptors) {
    counts.set(descriptor.name, (counts.get(descriptor.name) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
};

/**
 * Preview rows synthesised from field metadata.
 *
 * The alternative — freezing rows from a live run at save time — is a data
 * leak: one definition is visible to every tenant that opens the designer, so
 * whichever company the author happened to be in would have its figures on
 * everyone's canvas. Synthetic rows cost the author a little realism and cost
 * nobody their data.
 */
export const synthesiseSampleRows = (
  fields: readonly FieldMeta[],
  rowCount: number,
): ReportRow[] =>
  Array.from({ length: Math.max(1, rowCount) }, (_unused, index) => {
    const row: ReportRow = {};
    for (const field of fields) {
      row[field.name] = sampleValueFor(field, index);
    }
    return row;
  });

const sampleValueFor = (field: FieldMeta, index: number): unknown => {
  switch (field.type) {
    case 'boolean':
      return index % 2 === 0;
    case 'integer':
      return index + 1;
    case 'number':
      // Varied, not constant: a preview where every money column shows the same
      // figure hides a column that is bound to the wrong field.
      return Number((100 * (index + 1) + 0.5).toFixed(2));
    case 'date':
      return `2026-0${(index % 9) + 1}-15`;
    case 'datetime':
      return `2026-0${(index % 9) + 1}-15T10:30:00.000Z`;
    case 'object':
      return {};
    default:
      return `${field.label} ${index + 1}`;
  }
};
