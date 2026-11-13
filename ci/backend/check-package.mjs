#!/usr/bin/env node
// Release pipeline §2.2 step 9: the content check of a backend release zip.
//
//   node ci/backend/check-package.mjs <zip> [--platform win|linux] [--build <n>] [--commit <sha>]
//
// Lists the zip (its own reader: ZIP64 aware, no unzip/7z needed, same result on
// the Windows and Linux runners) and fails when
//   - an entry sits outside the one top folder (the zip name without .zip),
//   - a REQUIRED path is missing (node.exe, dist, prod node_modules with the
//     Prisma engine + CLI, prisma schema + migrations, the three JSON files…),
//   - a FORBIDDEN path is present (src/, test/, *.map, .env*, certs/, logs/, …),
//   - build-info.json is not for --build / --commit,
//   - the zip is over MAX_ZIP_MB.
// Prints the entry count, sizes and the largest files (E16) either way.
// Exit 0 = OK, 1 = the package is wrong, 2 = usage / unreadable zip.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { basename } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const MAX_ZIP_MB = 500;

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
const zipPath = args.find((a) => !a.startsWith('--'));
const option = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const platform = option('platform', 'win');
const expectBuild = option('build');
const expectCommit = option('commit');
if (!zipPath || !['win', 'linux'].includes(platform)) {
  console.error('usage: check-package.mjs <zip> [--platform win|linux] [--build <n>] [--commit <sha>]');
  process.exit(2);
}

// ---------------------------------------------------------------- zip reader
function readAt(fd, position, length) {
  const buffer = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const n = readSync(fd, buffer, done, length - done, position + done);
    if (n === 0) throw new Error(`unexpected end of file at ${position + done}`);
    done += n;
  }
  return buffer;
}

function listZip(path) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const tailLength = Math.min(size, 22 + 0xffff + 20);
    const tail = readAt(fd, size - tailLength, tailLength);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i -= 1) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('no end-of-central-directory record (not a zip?)');
    let total = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || tail.readUInt32LE(loc) !== 0x07064b50) throw new Error('ZIP64 locator missing');
      const recordOffset = Number(tail.readBigUInt64LE(loc + 8));
      const record = readAt(fd, recordOffset, 56);
      if (record.readUInt32LE(0) !== 0x06064b50) throw new Error('ZIP64 end record missing');
      total = Number(record.readBigUInt64LE(32));
      cdSize = Number(record.readBigUInt64LE(40));
      cdOffset = Number(record.readBigUInt64LE(48));
    }
    const cd = readAt(fd, cdOffset, cdSize);
    const entries = [];
    let p = 0;
    for (let n = 0; n < total; n += 1) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error(`bad central directory entry ${n}`);
      const flags = cd.readUInt16LE(p + 8);
      const method = cd.readUInt16LE(p + 10);
      let compressed = cd.readUInt32LE(p + 20);
      let uncompressed = cd.readUInt32LE(p + 24);
      const nameLength = cd.readUInt16LE(p + 28);
      const extraLength = cd.readUInt16LE(p + 30);
      const commentLength = cd.readUInt16LE(p + 32);
      let localOffset = cd.readUInt32LE(p + 42);
      const rawName = cd.subarray(p + 46, p + 46 + nameLength);
      const name = (flags & 0x800 ? rawName.toString('utf8') : rawName.toString('latin1'));
      let e = p + 46 + nameLength;
      const extraEnd = e + extraLength;
      while (e + 4 <= extraEnd) {
        const id = cd.readUInt16LE(e);
        const length = cd.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (uncompressed === 0xffffffff) { uncompressed = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (compressed === 0xffffffff) { compressed = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (localOffset === 0xffffffff) { localOffset = Number(cd.readBigUInt64LE(q)); q += 8; }
        }
        e += 4 + length;
      }
      entries.push({ name, method, compressed, uncompressed, localOffset });
      p = extraEnd + commentLength;
    }
    return { size, entries, read: (entry) => readEntry(fd, entry) };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

function readEntry(fd, entry) {
  const header = readAt(fd, entry.localOffset, 30);
  if (header.readUInt32LE(0) !== 0x04034b50) throw new Error(`bad local header for ${entry.name}`);
  const start = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const data = readAt(fd, start, entry.compressed);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`${entry.name}: compression method ${entry.method} is not supported`);
}

// ---------------------------------------------------------------- rules
const win = platform === 'win';
const REQUIRED = [
  win ? 'node.exe' : 'node',
  'dist/src/main.js',
  'dist/src/app.module.js',
  // No cloud-sync entries: ERP-Server keeps the cloud-sync module and its migration
  // out of git (.gitignore) and CloudSyncModule is commented out in app.module.ts.
  // The test repo committed both and required them here.
  'node_modules/@prisma/client/package.json',
  'node_modules/.prisma/client/index.js',
  'node_modules/.prisma/client/schema.prisma',
  win ? 'node_modules/.prisma/client/query_engine-windows.dll.node' : /^node_modules\/\.prisma\/client\/libquery_engine-.*\.so\.node$/,
  'node_modules/prisma/package.json',
  'node_modules/prisma/build/index.js',
  win ? 'node_modules/@prisma/engines/schema-engine-windows.exe' : /^node_modules\/@prisma\/engines\/schema-engine-[^/]+$/,
  'node_modules/@nestjs/core/package.json',
  'prisma/schema.prisma',
  'prisma/migrations/migration_lock.toml',
  /^prisma\/migrations\/[^/]+\/migration\.sql$/,
  /^prisma\/seed\/[^/]+\.sql$/,
  /^assets\/fonts\/[^/]+\.ttf$/,
  'package.json',
  'package-lock.json',
  'build-info.json',
  'compat.json',
  'releases.json',
  '.env.example',
];

// [rule, why]. Paths are relative to the top folder.
const FORBIDDEN = [
  [/^src\//, 'source code (src/)'],
  [/^test\//, 'tests (test/)'],
  [/\.map$/, 'a source map (*.map)'],
  [/(^|\/)\.env$|(^|\/)\.env\.(?!example$)[^/]*$/, 'an .env file'],
  [/^certs\//, 'certificates (certs/)'],
  [/^logs\//, 'logs (logs/)'],
  [/^release\//, 'old release binaries (release/)'],
  [/^coverage\//, 'coverage output'],
  [/^(ci|scripts|deploy|plan|docs|utils|dbml|\.github|\.vscode|\.git)\//, 'a dev-only folder'],
  [/^prisma\/(?!schema\.prisma$|migrations\/|seed\/)/, 'a prisma file other than schema, migrations, seed'],
  [/^dist\/.*\.spec\.js$/, 'a compiled unit test'],
  [/^dist\/test\//, 'compiled e2e tests'],
  [/\.tsbuildinfo$/, 'a TypeScript build-info file'],
  [/^(?!node_modules\/).*\.(pem|key|p12|pfx)$/, 'a key or certificate file'],
  [/(^|\/)id_(rsa|ecdsa|ed25519)(\.pub)?$/, 'an SSH key'],
  [/^node_modules\/(jest|ts-jest|ts-node|tsx|eslint|prettier|@nestjs\/cli|@types\/jest|pkg)\//, 'a dev dependency (npm ci --omit=dev was not used)'], // not typescript: a prod peer of @prisma/client
  [/^node_modules\/.prisma\/client\/.*\.bak$/, 'a stale Prisma engine backup'],
  [/^node_modules\/\.cache\//, 'a download/build cache (node_modules/.cache)'],
];

// ---------------------------------------------------------------- check
const errors = [];
let zip;
try {
  zip = listZip(zipPath);
} catch (error) {
  console.error(`::error::check-package: cannot read ${zipPath}: ${error.message}`);
  process.exit(2);
}
const top = basename(zipPath).replace(/\.zip$/i, '');
const files = new Map();
for (const entry of zip.entries) {
  const name = entry.name;
  if (name.includes('\\')) errors.push(`backslash in entry name: ${name}`);
  if (name.startsWith('/') || name.split('/').includes('..')) errors.push(`unsafe entry name: ${name}`);
  if (name !== `${top}/` && !name.startsWith(`${top}/`)) {
    errors.push(`outside the top folder ${top}/: ${name}`);
    continue;
  }
  const rel = name.slice(top.length + 1);
  if (rel && !rel.endsWith('/')) files.set(rel, entry);
}

for (const rule of REQUIRED) {
  const ok = typeof rule === 'string' ? files.has(rule) : [...files.keys()].some((f) => rule.test(f));
  if (!ok) errors.push(`required path missing: ${top}/${typeof rule === 'string' ? rule : rule.source}`);
}
const forbiddenHits = new Map();
for (const rel of files.keys()) {
  for (const [rule, why] of FORBIDDEN) {
    if (rule.test(rel)) {
      const list = forbiddenHits.get(why) ?? [];
      list.push(rel);
      forbiddenHits.set(why, list);
      break;
    }
  }
}
for (const [why, list] of forbiddenHits) {
  errors.push(`forbidden: ${why}: ${list.length} file(s), e.g. ${list.slice(0, 3).join(', ')}`);
}

const buildInfoEntry = files.get('build-info.json');
if (buildInfoEntry) {
  try {
    const info = JSON.parse(zip.read(buildInfoEntry).toString('utf8'));
    console.log(`build-info.json: ${JSON.stringify(info)}`);
    if (expectBuild && String(info.build) !== String(expectBuild)) {
      errors.push(`build-info.json build is ${info.build}, expected ${expectBuild}`);
    }
    if (expectCommit && info.commit !== expectCommit) {
      errors.push(`build-info.json commit is ${info.commit}, expected ${expectCommit}`);
    }
  } catch (error) {
    errors.push(`build-info.json is unreadable: ${error.message}`);
  }
}
for (const name of ['compat.json', 'releases.json', 'package.json']) {
  const entry = files.get(name);
  if (!entry) continue;
  try {
    JSON.parse(zip.read(entry).toString('utf8'));
  } catch (error) {
    errors.push(`${name} is not valid JSON: ${error.message}`);
  }
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);
const uncompressed = zip.entries.reduce((sum, e) => sum + e.uncompressed, 0);
if (zip.size > MAX_ZIP_MB * 1048576) errors.push(`the zip is ${mb(zip.size)} MB, over ${MAX_ZIP_MB} MB`);

const byFolder = new Map();
for (const [rel, entry] of files) {
  const parts = rel.split('/');
  const key = parts[0] === 'node_modules' && parts.length > 2
    ? `node_modules/${parts[1].startsWith('@') ? `${parts[1]}/${parts[2]}` : parts[1]}`
    : parts.length > 1 ? `${parts[0]}/` : parts[0];
  byFolder.set(key, (byFolder.get(key) ?? 0) + entry.uncompressed);
}
console.log(`zip: ${zipPath}`);
console.log(`     ${mb(zip.size)} MB compressed, ${mb(uncompressed)} MB unpacked, ${files.size} files`);
console.log('largest files:');
for (const [rel, e] of [...files].sort((a, b) => b[1].uncompressed - a[1].uncompressed).slice(0, 10)) {
  console.log(`  ${mb(e.uncompressed).padStart(7)} MB  ${rel}`);
}
console.log('largest folders / packages:');
for (const [key, bytes] of [...byFolder].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${mb(bytes).padStart(7)} MB  ${key}`);
}

if (errors.length > 0) {
  for (const message of errors) console.error(`::error::check-package: ${message}`);
  process.exit(1);
}
console.log(`check-package: OK (${REQUIRED.length} required paths present, nothing forbidden)`);
