import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The append-only ledger, asserted rather than trusted.
 *
 * Until 2026-09-21 three triggers stood between a service bug and rewritten
 * stock history: `tr_sml_immutable`, `tr_sml_forbid_delete` and
 * `tr_sml_forbid_truncate`. Migrations 20260922060000 / 20260922120000 dropped
 * them — the till posts OFFLINE and pushes on reconnect, and a trigger fires on
 * the SERVER during that push, on rows written hours earlier, in a language
 * nobody here debugs. The database now only RECORDS movements.
 *
 * So the guarantee is structural, and this is what makes it one:
 *
 *  * exactly ONE file may `INSERT INTO stock.stock_ledger` — the posting
 *    helper that `StockPostingService` runs, and that nothing else calls;
 *  * NOTHING, that file included, may UPDATE, DELETE or TRUNCATE it. A
 *    correction is a reversing row (`StockPostingService.cancel`), never an
 *    edit.
 *
 * It walks `src/` and fails on the first write it finds. A SOURCE test: it
 * needs no database, so it runs everywhere the suite does.
 */

const SRC = join(__dirname, '..', 'src');

/** The one file allowed to INSERT. */
const OWNER = join('modules', 'stocks', 'stock-voucher', 'stock-voucher-posting.helper.ts');

/**
 * `stock_ledger` is a prefix of the partition names (`stock_ledger_2026_2027`),
 * hence the `(?!_)`; those are never named in source, but a regex that would
 * pass them is a regex nobody re-checks.
 */
const INSERTS = /INSERT\s+INTO\s+(stock\.)?stock_ledger\b(?!_)/gi;
const MUTATIONS =
  /(UPDATE\s+(stock\.)?stock_ledger\b(?!_)|DELETE\s+FROM\s+(stock\.)?stock_ledger\b(?!_)|TRUNCATE\s+(TABLE\s+)?(stock\.)?stock_ledger\b(?!_))/gi;

/** The Prisma model API, the other way a row could be written. */
const PRISMA_WRITES =
  /\bstockLedger\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;

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

function hits(text: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const hit of text.matchAll(re)) {
    const line = text.slice(0, hit.index ?? 0).split('\n').length;
    out.push(`${line} — ${hit[0].replace(/\s+/g, ' ')}`);
  }
  return out;
}

describe('stock.stock_ledger has one writer and is append-only (plan A2, rule 1)', () => {
  const files = walk(SRC).filter((f) => !f.endsWith('.spec.ts'));
  const sources = files.map((f) => ({
    rel: relative(SRC, f).split(sep).join('/'),
    text: readFileSync(f, 'utf8'),
  }));
  const owner = OWNER.split(sep).join('/');

  it('finds source to scan at all — a silent zero would pass forever', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(sources.some((s) => s.rel === owner)).toBe(true);
  });

  it('the owner really does insert, so the rule is guarding something', () => {
    const helper = sources.find((s) => s.rel === owner);
    expect(hits(helper?.text ?? '', INSERTS).length).toBeGreaterThan(0);
  });

  it('nothing outside the posting helper inserts into stock.stock_ledger', () => {
    const offenders = sources
      .filter((s) => s.rel !== owner)
      .flatMap((s) => hits(s.text, INSERTS).map((h) => `${s.rel}:${h}`));
    expect(offenders).toEqual([]);
  });

  it('nothing — the posting helper included — updates, deletes or truncates it', () => {
    const offenders = sources.flatMap((s) => hits(s.text, MUTATIONS).map((h) => `${s.rel}:${h}`));
    expect(offenders).toEqual([]);
  });

  it('nothing writes it through the Prisma model either', () => {
    const offenders = sources.flatMap((s) =>
      hits(s.text, PRISMA_WRITES).map((h) => `${s.rel}:${h}`),
    );
    expect(offenders).toEqual([]);
  });
});
