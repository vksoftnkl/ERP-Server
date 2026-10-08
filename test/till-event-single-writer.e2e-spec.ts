import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * accounts.till_event is append-only (47 §8): "INSERT only, never UPDATE:
 * TillEventService is the single writer and a test asserts no other file
 * writes it (the stock_ledger pattern)". This is that test.
 *
 *  * exactly ONE file may write the table — services/till-event.service.ts,
 *    through `tillEvent.create` or a raw `INSERT INTO accounts.till_event`;
 *  * NOTHING, that file included, may UPDATE, DELETE or TRUNCATE it. A wrong
 *    event is answered by a later event, never by an edit.
 *
 * A SOURCE test: it walks src/ and needs no database. (The e2e suites delete
 * their own rows in teardown — test/, not src/, and not part of the product.)
 */

const SRC = join(__dirname, '..', 'src');
const OWNER = join('modules', 'till', 'services', 'till-event.service.ts');

// `till_event` prefixes its partition names (till_event_2026_2027), hence (?!_).
const RAW_INSERT = /INSERT\s+INTO\s+(accounts\.)?till_event\b(?!_)/gi;
const RAW_MUTATION =
  /(UPDATE\s+(accounts\.)?till_event\b(?!_)|DELETE\s+FROM\s+(accounts\.)?till_event\b(?!_)|TRUNCATE\s+(TABLE\s+)?(accounts\.)?till_event\b(?!_))/gi;
const PRISMA_CREATE = /\btillEvent\s*\.\s*(create|createMany)\b/g;
const PRISMA_MUTATION = /\btillEvent\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/g;

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

describe('accounts.till_event has one writer and is append-only', () => {
  const files = walk(SRC).map((full) => ({ path: relative(SRC, full), text: readFileSync(full, 'utf8') }));

  it('the owner file exists and writes it', () => {
    const owner = files.find((f) => f.path === OWNER);
    expect(owner).toBeDefined();
    expect(hits(owner!.text, PRISMA_CREATE).length + hits(owner!.text, RAW_INSERT).length).toBeGreaterThan(0);
  });

  it('no other file inserts into it', () => {
    const offenders = files
      .filter((f) => f.path !== OWNER)
      .flatMap((f) => [...hits(f.text, PRISMA_CREATE), ...hits(f.text, RAW_INSERT)].map((h) => `${f.path}:${h}`));
    expect(offenders).toEqual([]);
  });

  it('no file — the owner included — updates, deletes or truncates it', () => {
    const offenders = files.flatMap((f) =>
      [...hits(f.text, PRISMA_MUTATION), ...hits(f.text, RAW_MUTATION)].map((h) => `${f.path}:${h}`),
    );
    expect(offenders).toEqual([]);
  });
});
