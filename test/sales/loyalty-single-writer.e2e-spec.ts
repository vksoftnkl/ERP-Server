import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * §3.4b, asserted rather than trusted.
 *
 * > ONE private method on `LoyaltyLedgerService` is the only code in the
 * > entire codebase that inserts, updates or soft-deletes
 * > `sales.loyalty_ledger`. The same for `loyalty_coupon_txn` and
 * > `loyalty_coupon`.
 *
 * A trigger could not be forgotten. A service call can, and there are NINE
 * write paths into that ledger — earn, consume, cancel reversal, return
 * claw-back, expiry, gift, adjust, transfer, opening. The rule turns nine
 * places to get right into one, and it is only a rule while something checks
 * it: the moment a repository, a sync handler or a migration script writes a
 * row directly, the recompute stops happening and every wallet drifts with no
 * error anywhere.
 *
 * So this walks `src/` and fails on the first write it finds outside the
 * service. It is a SOURCE test and needs no database.
 */

const SRC = join(__dirname, '..', '..', 'src');

/** The three tables, and the one file allowed to write them. */
const GUARDED = ['loyalty_ledger', 'loyalty_coupon_txn', 'loyalty_coupon'] as const;
const OWNER = join('modules', 'sales', 'posting', 'loyalty-ledger.service.ts');

/**
 * Raw SQL that writes. `loyalty_coupon` is a prefix of `loyalty_coupon_txn`
 * and `loyalty_coupon_batch`, so the table name is anchored on a word
 * boundary — `loyalty_coupon_batch` is a master and is NOT guarded.
 */
function sqlWrites(table: string): RegExp {
  return new RegExp(
    String.raw`(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(sales\.)?${table}\b(?!_)`,
    'gi',
  );
}

/** The Prisma model API, which is the other way a row could be written. */
function prismaWrites(model: string): RegExp {
  return new RegExp(
    String.raw`\b${model}\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b`,
    'g',
  );
}

const PRISMA_MODELS: Record<string, string> = {
  loyalty_ledger: 'loyaltyLedger',
  loyalty_coupon_txn: 'loyaltyCouponTxn',
  loyalty_coupon: 'loyaltyCoupon',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('LoyaltyLedgerService is the only writer of the loyalty tables (§3.4b)', () => {
  const files = walk(SRC).filter((f) => !f.endsWith('.spec.ts'));

  it('finds source to scan at all — a silent zero would pass forever', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => relative(SRC, f) === OWNER)).toBe(true);
  });

  it.each(GUARDED)('nothing outside the service writes sales.%s', (table) => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(SRC, file);
      if (rel === OWNER) {
        continue;
      }
      const text = readFileSync(file, 'utf8');
      // `loyaltyCoupon.create` would also match `loyaltyCouponTxn.create`
      // without the boundary the regex builders already apply.
      for (const re of [sqlWrites(table), prismaWrites(PRISMA_MODELS[table])]) {
        for (const hit of text.matchAll(re)) {
          const line = text.slice(0, hit.index ?? 0).split('\n').length;
          offenders.push(`${rel.split(sep).join('/')}:${line} — ${hit[0].replace(/\s+/g, ' ')}`);
        }
      }
    }

    // Name them. "expected 0 got 2" sends the next reader hunting.
    expect(offenders).toEqual([]);
  });
});
