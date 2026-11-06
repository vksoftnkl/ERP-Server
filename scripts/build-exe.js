#!/usr/bin/env node
/**
 * Packs the compiled server in dist/ into one executable with Node 22 built in.
 * Only what the server loads goes in (see the ignore list in buildConfig), and
 * it is Brotli-compressed: about 87 MB on Windows and 103 MB on Linux, of which
 * Node itself is 57 / 74 MB. Zstd builds faster (25 s vs ~170 s) but is 7 MB
 * bigger and doubled the server's memory in testing; None is 179 MB on Linux.
 *
 *   node scripts/build-exe.js [win|linux] [--out <dir>] [--compress Brotli|GZip|Zstd|None]
 *
 *   win   (default) -> release/erp-server-win/erp-server.exe
 *   linux           -> release/erp-server-linux-x64/erp-server
 *
 * It packs dist/ exactly as it is. Recompile first if src/ changed:
 * `npm run release:win` runs `npm run build` and then this script, and
 * `npm run release:win:dist` runs only this script.
 *
 * The output folder holds the executable, assets/fonts (the print fonts, which
 * must sit beside it), .env.example and a start script (start-erp-server.bat on
 * Windows, start-erp-server.sh on Linux). The Linux folder also gets
 * run-erp-server.sh (the double-click launcher) and install-service.sh /
 * uninstall-service.sh / erp-server-service.sh, which set the server up as a
 * systemd service that starts at boot. The templates live in deploy/exe/.
 * The dev .env is never packed.
 *
 * The Linux build carries Prisma's debian-openssl-3.0.x engine, so the target
 * needs OpenSSL 3 (Ubuntu 22.04+, Debian 12+, RHEL 9+) and glibc 2.28+.
 *
 * Packager: @yao-pkg/pkg, run through npx so node_modules is left alone. The old
 * `pkg` 5.x in devDependencies stops at Node 18, which NestJS 11 does not run on.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PKG_PACKAGE = '@yao-pkg/pkg@6.25.0';
const NODE_RANGE = 'node22';
// Compresses every packed file; the exe unpacks each one in memory on first read.
const COMPRESSIONS = ['Brotli', 'GZip', 'Zstd', 'None'];
const DEFAULT_COMPRESSION = 'Brotli';

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'deploy', 'exe');
// The pkg config is written to its own folder for the length of the build, NOT
// the repo root: pkg packs every "dependencies" entry of the top-level package,
// and from the root that would be this repo's package.json (Prisma CLI,
// TypeScript, a second redis client: about 48 MB nobody loads). pkg resolves
// asset globs and patch keys relative to the config file, so relocate() rewrites
// every path relative to this folder.
const CONFIG_DIR = path.join(ROOT, 'release', '.pkg-build');
const CONFIG_FILE = path.join(CONFIG_DIR, 'pkg.config.json');

const TARGETS = {
  win: {
    pkgTarget: `${NODE_RANGE}-win-x64`,
    outDir: path.join(ROOT, 'release', 'erp-server-win'),
    exeName: 'erp-server.exe',
    tempName: 'erp-server.new.exe',
    engine: 'node_modules/.prisma/client/query_engine-windows.dll.node',
    eol: '\r\n',
    launcher: 'start-erp-server.bat',
    extras: [],
  },
  linux: {
    pkgTarget: `${NODE_RANGE}-linux-x64`,
    outDir: path.join(ROOT, 'release', 'erp-server-linux-x64'),
    exeName: 'erp-server',
    tempName: 'erp-server.new',
    engine: 'node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node',
    eol: '\n',
    launcher: 'start-erp-server.sh',
    // Auto-start at boot (systemd) and the double-click launcher.
    extras: ['run-erp-server.sh', 'install-service.sh', 'uninstall-service.sh', 'erp-server-service.sh'],
  },
};

function fail(message) {
  console.error(`\n[build-exe] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let targetName = 'win';
  let outDir = null;
  let compress = DEFAULT_COMPRESSION;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      outDir = argv[i + 1];
      i += 1;
      if (!outDir) fail('--out needs a folder.');
    } else if (arg === '--compress') {
      compress = COMPRESSIONS.find((c) => c.toLowerCase() === String(argv[i + 1]).toLowerCase());
      i += 1;
      if (!compress) fail(`--compress takes one of ${COMPRESSIONS.join(', ')}.`);
    } else if (TARGETS[arg]) {
      targetName = arg;
    } else {
      fail(`Unknown argument "${arg}". Usage: node scripts/build-exe.js [win|linux] [--out <dir>] [--compress ${COMPRESSIONS.join('|')}]`);
    }
  }
  const target = TARGETS[targetName];
  return { targetName, target, compress, outDir: outDir ? path.resolve(outDir) : target.outDir };
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * pkg cannot follow package.json "imports" (#subpath) requires, which Prisma's
 * generated client and pdfkit both use, nor a package with "exports" but no
 * "main". The patches turn those into plain relative requires inside the exe;
 * the files in node_modules are not touched. Each search string must appear
 * exactly once (pkg replaces the first hit only). After a Prisma or pdfkit
 * upgrade, this check fails loudly instead of producing an exe that crashes at
 * boot or cannot print.
 */
function buildPatches() {
  const patches = {};
  const add = (rel, pairs) => {
    const body = read(rel);
    for (let i = 0; i < pairs.length; i += 2) {
      const hits = occurrences(body, pairs[i]);
      if (hits !== 1) {
        fail(`Patch target changed: "${pairs[i]}" occurs ${hits} times in ${rel} (expected 1). Re-check the patches in scripts/build-exe.js.`);
      }
    }
    patches[rel] = pairs;
  };

  add('node_modules/.prisma/client/default.js', ["require('#main-entry-point')", "require('./index.js')"]);

  const pdfkitPkg = JSON.parse(read('node_modules/pdfkit/package.json'));
  if (pdfkitPkg.main) fail('pdfkit/package.json now has a "main"; drop its patch in scripts/build-exe.js.');
  add('node_modules/pdfkit/package.json', ['"exports": {', '"main": "./js/pdfkit.js",\n  "exports": {']);

  const pdfkitJs = 'node_modules/pdfkit/js/pdfkit.js';
  const fonts = [...new Set([...read(pdfkitJs).matchAll(/require\$1\('#standard-fonts\/([A-Za-z]+)'\)/g)].map((m) => m[1]))].sort();
  if (fonts.length !== 14) fail(`Expected pdfkit's 14 standard fonts in ${pdfkitJs}, found ${fonts.length}.`);
  const fontPairs = [];
  for (const font of fonts) {
    if (!fs.existsSync(path.join(ROOT, 'node_modules/pdfkit/js/standard-fonts', `${font}.cjs`))) {
      fail(`pdfkit standard font file ${font}.cjs is missing.`);
    }
    fontPairs.push(`require$1('#standard-fonts/${font}')`, `require('./standard-fonts/${font}.cjs')`);
  }
  add(pdfkitJs, fontPairs);

  return patches;
}

// Prisma client files the server loads: .prisma/client/default.js -> index.js ->
// @prisma/client/runtime/library.js, which loads the native engine. Everything
// else in those folders (edge/wasm/browser builds, other databases' engines,
// typings) is never required and is kept out through ignore().
const PRISMA_CLIENT_FILES = ['index.js', 'default.js', 'package.json', 'schema.prisma'];
const PRISMA_RUNTIME_FILES = ['library.js'];

function buildConfig(target) {
  const engineFile = path.posix.basename(target.engine);
  const prismaFiles = [
    ...PRISMA_CLIENT_FILES.map((f) => `node_modules/.prisma/client/${f}`),
    target.engine,
    'node_modules/@prisma/client/package.json',
    ...PRISMA_RUNTIME_FILES.map((f) => `node_modules/@prisma/client/runtime/${f}`),
  ];
  for (const rel of prismaFiles) {
    if (!fs.existsSync(path.join(ROOT, rel))) {
      fail(`${rel} is missing. Run "npm run prisma:generate" (the schema must list this platform in binaryTargets).`);
    }
  }

  // dist/ itself is not listed: pkg follows its requires from main.js and stores
  // it as V8 bytecode only, so the compiled source is not readable in the exe.
  const assets = [
    ...prismaFiles,
    // The boot seed reads prisma/seed through its __dirname fallback. Migrations
    // and schema fragments stay out: the exe never migrates (migrate-deploy.ts
    // refuses when process.pkg is set).
    'prisma/seed/**/*',
    'assets/fonts/**/*',
    // Swagger UI page assets and pdfkit's AFM font metrics are read with fs.
    'node_modules/swagger-ui-dist/**/*',
    'node_modules/pdfkit/js/data/**/*',
  ];

  // Matched against absolute paths of everything pkg would pack, including what
  // it pulls in on its own from package.json dependencies and require.resolve.
  const ignore = [
    // The Prisma CLI (about 60 MB with @prisma/config, effect, c12, jiti, the
    // engines downloader): reached only through migrate-deploy's require.resolve.
    '**/node_modules/prisma/**',
    `**/node_modules/.prisma/client/!(${[...PRISMA_CLIENT_FILES, engineFile].join('|')})`,
    `**/node_modules/@prisma/client/runtime/!(${PRISMA_RUNTIME_FILES.join('|')})`,
    '**/node_modules/swagger-ui-dist/swagger-ui-es-bundle*',
    '**/*.map',
    '**/*.d.ts',
    '**/*.d.mts',
  ];

  return {
    name: 'erp-server',
    bin: 'dist/src/main.js',
    pkg: {
      assets,
      ignore,
      // pdfkit's entry and its standard-font modules are loaded through the
      // "imports" map that the patches rewrite, so list them for compilation.
      scripts: ['node_modules/pdfkit/js/pdfkit.js', 'node_modules/pdfkit/js/output.cjs', 'node_modules/pdfkit/js/standard-fonts/*.cjs'],
      patches: buildPatches(),
      targets: [target.pkgTarget],
    },
  };
}

/** Rewrites the repo-relative paths in the config relative to CONFIG_DIR. */
function relocate(config) {
  const fromConfig = (rel) => path.relative(CONFIG_DIR, path.join(ROOT, rel)).split(path.sep).join('/');
  const probe = fromConfig('dist');
  if (path.isAbsolute(probe)) fail(`Cannot express ${ROOT} relative to ${CONFIG_DIR}.`);
  const patches = {};
  for (const [key, pairs] of Object.entries(config.pkg.patches)) patches[fromConfig(key)] = pairs;
  return {
    ...config,
    bin: fromConfig(config.bin),
    pkg: {
      ...config.pkg,
      assets: config.pkg.assets.map(fromConfig),
      scripts: config.pkg.scripts.map(fromConfig),
      patches,
    },
  };
}

function runPkg(target, outFile, compress) {
  const args = ['--yes', PKG_PACKAGE, '--config', CONFIG_FILE, '--fallback-to-source', '--compress', compress, '--output', outFile, path.join(ROOT, 'dist', 'src', 'main.js')];
  const isWin = process.platform === 'win32';
  // On Windows npx is a .cmd and needs a shell, so quote the paths (the repo path has a space).
  const shellArgs = isWin ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args;
  console.log(`[build-exe] npx ${PKG_PACKAGE} -> ${target.pkgTarget}, compress=${compress}`);
  const result = spawnSync(isWin ? 'npx.cmd' : 'npx', shellArgs, { cwd: ROOT, stdio: 'inherit', shell: isWin });
  if (result.error) return `Could not start npx: ${result.error.message}`;
  if (result.status !== 0) return `pkg exited with code ${result.status}.`;
  return null;
}

function copyTemplate(name, destDir, eol) {
  const body = fs.readFileSync(path.join(TEMPLATES, name), 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(path.join(destDir, name), eol === '\n' ? body : body.replace(/\n/g, eol));
}

function main() {
  const { targetName, target, compress, outDir } = parseArgs(process.argv.slice(2));

  const mainJs = path.join(ROOT, 'dist', 'src', 'main.js');
  if (!fs.existsSync(mainJs)) fail('dist/src/main.js is missing. Run "npm run build" first.');
  const distAge = fs.statSync(mainJs).mtime;
  console.log(`[build-exe] target=${targetName}  dist/src/main.js compiled ${distAge.toLocaleString()}`);

  const config = buildConfig(target);
  fs.mkdirSync(outDir, { recursive: true });
  // Build beside the old exe and swap at the end, so a failed build leaves the
  // previous exe in place.
  const finalExe = path.join(outDir, target.exeName);
  const tempExe = path.join(outDir, target.tempName);

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(relocate(config), null, 2)}\n`);
  let error;
  try {
    error = runPkg(target, tempExe, compress);
  } finally {
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
  }
  if (error) {
    fs.rmSync(tempExe, { force: true });
    fail(`${error} The previous ${target.exeName} (if any) was left in place.`);
  }
  if (!fs.existsSync(tempExe)) fail(`pkg finished but ${tempExe} was not written.`);
  fs.renameSync(tempExe, finalExe);
  if (target.eol === '\n') fs.chmodSync(finalExe, 0o755);

  // Fonts beside the exe: the font registry looks next to the executable.
  const fontsOut = path.join(outDir, 'assets', 'fonts');
  fs.rmSync(fontsOut, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'assets', 'fonts'), fontsOut, { recursive: true });

  copyTemplate('.env.example', outDir, target.eol);
  for (const script of [target.launcher, ...target.extras]) {
    copyTemplate(script, outDir, target.eol);
    if (target.eol === '\n') fs.chmodSync(path.join(outDir, script), 0o755);
  }

  const sizeMb = (fs.statSync(finalExe).size / 1024 / 1024).toFixed(0);
  console.log(`\n[build-exe] Done: ${finalExe} (${sizeMb} MB)`);
  console.log(`[build-exe] Copy the whole folder ${outDir} to the target PC.`);
}

main();
