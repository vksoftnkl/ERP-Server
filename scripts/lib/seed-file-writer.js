'use strict';

/**
 * Shared engine behind the seed exporters (scripts/export-ui-config-seeds.js,
 * scripts/export-master-seeds.js).
 *
 * It turns a table config plus the rows of a reference database into an idempotent
 * .sql file in prisma/seed, in the style the rest of that folder is written in:
 * a documented header, one aligned row per record, a conflict clause that leaves
 * existing data alone, and -- where the primary key comes from a sequence -- a
 * setval so the next row created from the UI cannot collide with a seeded id.
 */

const path = require('node:path');
const { writeFileSync } = require('node:fs');

/** Tag for dollar-quoted SQL bodies; the writer refuses data that contains it. */
const DOLLAR_TAG = '$seed$';
/** Padding is for readability -- long values are left unpadded so lines stay sane. */
const MAX_PAD_WIDTH = 34;

const literal = (value) => (value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const bool = (value) => (value === null ? 'NULL' : value ? 'true' : 'false');
const plain = (value) => (value === null ? 'NULL' : String(value));
const dollar = (value) => {
  if (value === null) {
    return 'NULL';
  }
  const text = String(value);
  if (text.includes(DOLLAR_TAG)) {
    throw new Error(`Value contains the dollar-quote tag ${DOLLAR_TAG}; pick another tag.`);
  }
  return `${DOLLAR_TAG}${text}${DOLLAR_TAG}`;
};

/**
 * @param name    column name in the database
 * @param kind    literal | plain | bool | dollar | const
 * @param pgType  type pinned on the first VALUES row (may be an enum, e.g. accounts."VoucherNature")
 * @param options value (for kind 'const'), quote (identifier needs double quotes), ownLine
 *
 * A table config may also carry `source`: a FROM clause used in place of the table
 * name when reading the rows (a filtered or ordered derived table). The columns
 * listed here must all exist on it.
 */
const column = (name, kind, pgType, options = {}) => ({
  name,
  kind,
  pgType,
  sqlName: options.quote ? `"${name}"` : name,
  ...options,
});

const renderCell = (spec, row) => {
  if (spec.kind === 'const') {
    return spec.value;
  }
  const value = row[spec.name];
  switch (spec.kind) {
    case 'bool':
      return bool(value);
    case 'plain':
      return plain(value);
    case 'dollar':
      return dollar(value);
    default:
      return literal(value);
  }
};

const buildRows = (config, rows) => {
  const cells = rows.map((row) => config.columns.map((spec) => renderCell(spec, row)));
  const widths = config.columns.map((spec, index) => {
    if (spec.ownLine) {
      return 0;
    }
    const widest = cells.reduce((max, cell) => Math.max(max, cell[index].length), 0);
    return widest <= MAX_PAD_WIDTH ? widest : 0;
  });
  return cells.map((cell) =>
    cell.map((value, index) => (widths[index] ? value.padEnd(widths[index]) : value)).join(', '),
  );
};

const sequenceStatement = (config) =>
  [
    '',
    '-- Keep the identity sequence ahead of the seeded ids, so the next row created from',
    '-- the UI does not collide with one of them.',
    'SELECT setval(',
    `    pg_get_serial_sequence('${config.table}', '${config.sequenceColumn}'),`,
    `    (SELECT GREATEST(COALESCE(MAX(${config.sequenceColumn}), 0), 1) FROM ${config.table}),`,
    '    true',
    ');',
  ].join('\n');

const buildFile = (config, rows, labels) => {
  const columnNames = config.columns.map((spec) => spec.sqlName);
  const rendered = buildRows(config, rows);
  const casts = config.columns.map((spec) => `::${spec.pgType}`);
  const lines = [...config.header(rows.length)];
  lines.push(
    `-- Regenerate with: npm run ${config.regenerateScript}`,
    `-- Run: psql "$DATABASE_URL" -f prisma/seed/${config.file}`,
    `--      or: npm run seed:run -- --only=${config.file}`,
    '',
    'BEGIN;',
    '',
    `INSERT INTO ${config.table}`,
    `    (${columnNames.join(', ')})`,
  );
  lines.push(config.guard ? 'SELECT v.* FROM (VALUES' : 'VALUES');

  let currentGroup;
  rows.forEach((row, index) => {
    if (config.groupBy) {
      const groupValue = row[config.groupBy.column];
      if (groupValue !== currentGroup) {
        currentGroup = groupValue;
        const label = labels.get(String(groupValue)) ?? '(unnamed)';
        lines.push(`    -- ============ ${label} (id ${groupValue}) ============`);
      }
    }
    // Types are pinned on the first row only: PostgreSQL resolves each VALUES column
    // from every entry, so the later unknown literals adopt these types. Without them
    // a uuid/numeric/enum column would arrive as text and the INSERT would be rejected.
    const body =
      index === 0
        ? config.columns
            .map((spec, columnIndex) => `${renderCell(spec, row)}${casts[columnIndex]}`)
            .join(', ')
        : rendered[index];
    lines.push(`${index === 0 ? '     ' : '    ,'}(${body})`);
  });

  if (config.guard) {
    lines.push(
      `) AS v(${columnNames.join(', ')})`,
      'WHERE NOT EXISTS (',
      `  SELECT 1 FROM ${config.table} ${config.guard.alias}`,
      `   WHERE ${config.guard.alias}.${config.guard.column} = v.${config.guard.column}`,
      ')',
    );
    // Optional second clause for a child table whose parent rows may have been
    // skipped by their own guard: without it the insert would hit the foreign key
    // and abort the file instead of quietly leaving that branch alone.
    const parent = config.guard.requireExists;
    if (parent) {
      lines.push(
        `  AND EXISTS (`,
        `  SELECT 1 FROM ${parent.table} ${parent.alias}`,
        `   WHERE ${parent.alias}.${parent.column} = v.${parent.localColumn}`,
        ')',
      );
    }
  }
  // A null conflictTarget emits the untargeted form, which swallows a violation of ANY
  // unique constraint on the table -- not just the primary key. Needed where a database
  // may already hold the same logical row under a different id (see Acc_Voucher_Type.sql):
  // a targeted ON CONFLICT would let that row raise on the other unique index and abort
  // the whole file, taking the rows that WERE missing down with it.
  lines.push(
    config.conflictTarget
      ? `ON CONFLICT (${config.conflictTarget}) DO NOTHING;`
      : 'ON CONFLICT DO NOTHING;',
  );
  if (config.sequenceColumn) {
    lines.push(sequenceStatement(config));
  }
  lines.push('', 'COMMIT;', '');
  return lines.join('\n');
};

/** Reads every configured table and writes its seed file. Returns [{file, rows}]. */
const exportSeedFiles = async ({ client, seedDir, tables, regenerateScript }) => {
  const written = [];
  for (const config of tables) {
    const withScript = { regenerateScript, ...config };
    const columnList = config.columns
      .filter((spec) => spec.kind !== 'const')
      .map((spec) => spec.sqlName)
      .join(', ');
    const { rows } = await client.query(
      // `source` lets a table be read through a derived table instead of itself -- the
      // account groups need a recursive CTE to come out parent-before-child. It only
      // changes the read; INSERT INTO and the setval still name config.table.
      `SELECT ${columnList} FROM ${config.source ?? config.table} ORDER BY ${config.orderBy}`,
    );
    const labels = new Map();
    if (config.groupBy) {
      const labelResult = await client.query(config.groupBy.labelSql);
      for (const row of labelResult.rows) {
        labels.set(String(row.id), row.label);
      }
    }
    writeFileSync(path.join(seedDir, config.file), buildFile(withScript, rows, labels));
    written.push({ file: config.file, rows: rows.length });
  }
  return written;
};

module.exports = { column, exportSeedFiles, DOLLAR_TAG };
