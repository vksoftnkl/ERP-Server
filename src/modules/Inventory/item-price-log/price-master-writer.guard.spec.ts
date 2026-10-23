import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Prisma } from '@prisma/client';

/**
 * Notes 144 / plan §2.5 — THE GUARD: no code but PriceMasterWriter writes
 * inventory.item_price_master or inventory.item_qty_price. A write anywhere
 * else is a price change the log never sees, so this fails the build on one —
 * a Prisma model write, a nested write through a relation, or raw SQL.
 *
 * Moving a write into the writer is the fix; widening ALLOWED is not.
 */
const SRC = join(__dirname, '..', '..', '..');
const ALLOWED = new Set(['modules/Inventory/item-price-log/price-master-writer.service.ts']);

const PRICE_MODELS = ['ItemPriceMaster', 'ItemQtyPrice'];
const MODEL_DELEGATES = ['itemPriceMaster', 'itemQtyPrice'];
const WRITE_METHODS =
  'create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany';
const NESTED_WRITES =
  'create|createMany|connectOrCreate|update|updateMany|upsert|delete|deleteMany|set';

/** Every relation list on another model that points at a price model — read off the schema, never typed. */
const RELATIONS = Prisma.dmmf.datamodel.models.flatMap((model) =>
  model.fields
    .filter((field) => field.kind === 'object' && field.isList && PRICE_MODELS.includes(field.type))
    .map((field) => field.name),
);

const RULES: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'a Prisma write on a price model',
    pattern: new RegExp(`\\.(${MODEL_DELEGATES.join('|')})\\s*\\.\\s*(${WRITE_METHODS})\\s*\\(`),
  },
  {
    name: 'a nested write through a relation to a price model',
    pattern: new RegExp(
      `\\b(${[...new Set(RELATIONS)].join('|')})\\s*:\\s*\\{\\s*(${NESTED_WRITES})\\b`,
    ),
  },
  {
    name: 'raw SQL writing a price table',
    pattern:
      /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(\s+TABLE)?|COPY)\s+(ONLY\s+)?"?(inventory"?\s*\.\s*"?)?(item_price_master|item_qty_price)\b/i,
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Comments out: a sentence about an UPDATE is not one. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('price writes go through PriceMasterWriter (notes 144 §2.5)', () => {
  const files = sourceFiles(SRC).map((path) => ({
    path: relative(SRC, path).split('\\').join('/'),
    text: code(readFileSync(path, 'utf8')),
  }));

  it('finds the relations to guard from the schema', () => {
    expect(RELATIONS).toEqual(expect.arrayContaining(['prices', 'qtyPrices', 'itemPrices']));
  });

  it.each(RULES)('no $name outside the writer', ({ pattern }) => {
    const offenders = files
      .filter((file) => !ALLOWED.has(file.path))
      .flatMap((file) =>
        file.text
          .split('\n')
          .map((line, index) => ({ line: line.trim(), at: `${file.path}:${index + 1}` }))
          .filter(({ line }) => pattern.test(line))
          .map(({ at, line }) => `${at}  ${line}`),
      );
    expect(offenders).toEqual([]);
  });

  it('the writer itself still holds the writes (the guard is not guarding nothing)', () => {
    const writer = files.find((file) => ALLOWED.has(file.path));
    expect(writer).toBeDefined();
    expect(RULES[0].pattern.test(writer!.text)).toBe(true);
    expect(RULES[2].pattern.test(writer!.text)).toBe(true);
  });
});
