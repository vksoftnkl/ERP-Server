#!/usr/bin/env node
// Part B Step 4 §4.1 / §5 / §6: writes the three files a backend package carries.
//
//   build-info.json  { version, build, commit, builtAt }        this backend
//   compat.json      { backendBuild, generatedAt, clients }     expected client build per platform
//   releases.json    { generatedAt, releases: [...] }           every client release, yanked ones too
//
// compat.json takes, per platform, the latest LIVE registered release (its build
// and download link), unless WEB_BUILD / DESKTOP_BUILD / MOBILE_BUILD override it
// (workflow_dispatch inputs). A platform with neither is left out (the backend
// then keeps what it has). Nothing secret is written (not even the registry URL).
//
// No registry (CI_API_URL unset, as in the release pipeline test repo): the
// release list is empty and compat.json carries only the overrides, if any.
//
// Env:
//   BUILD          required, this backend's build (run_number + offset)
//   COMMIT         default: git rev-parse HEAD
//   VERSION        default: package.json version
//   OUT_DIR        default: .
//   CI_API_URL     e.g. https://cloud.example.com/api/v1   (release registry)
//   CI_USER / CI_PASSWORD   the ci-release user (RELEASE MANAGER)
//   WEB_BUILD / DESKTOP_BUILD / MOBILE_BUILD   optional overrides (blank = registry)
//
// Node 20+ (global fetch). Exit 1 on any failure: a package must never ship
// with a half-written compat.json or release list.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLATFORMS = ['web', 'desktop', 'mobile'];
const MAX_BUILD = 2_147_483_647;

function fail(message) {
  console.error(`::error::write-package-files: ${message}`);
  process.exit(1);
}

function buildNumber(value, name) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,10}$/.test(text) || Number(text) < 1 || Number(text) > MAX_BUILD) {
    fail(`${name} must be a whole number 1..${MAX_BUILD} (got "${text}")`);
  }
  return Number(text);
}

function optionalOverride(name) {
  const text = (process.env[name] ?? '').trim();
  return text ? buildNumber(text, name) : null;
}

async function api(base, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!response.ok) {
    const code = json?.errors?.[0]?.code ?? json?.code ?? '';
    fail(`${method} ${path} answered ${response.status} ${code}`.trim());
  }
  return json;
}

async function main() {
  const build = buildNumber(process.env.BUILD, 'BUILD');
  const outDir = process.env.OUT_DIR?.trim() || '.';
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = (process.env.VERSION ?? '').trim() || pkg.version || 'unknown';
  const commit =
    (process.env.COMMIT ?? '').trim() ||
    execSync('git rev-parse --short=8 HEAD', { encoding: 'utf8' }).trim();
  const now = new Date().toISOString();

  const base = (process.env.CI_API_URL ?? '').trim().replace(/\/+$/, '');
  const user = process.env.CI_USER ?? '';
  const password = process.env.CI_PASSWORD ?? '';
  let all = [];
  if (!base) {
    console.log('no release registry configured (CI_API_URL unset): releases.json is empty');
  } else {
    if (!user || !password) {
      fail('CI_API_URL is set, so CI_USER and CI_PASSWORD are required (the release registry)');
    }
    // No X-App-* headers and no device_type: the build check never applies to CI.
    const login = await api(base, '/auth/login', {
      method: 'POST',
      body: { usrLoginName: user, usrPassword: password },
    });
    const token = login?.access_token;
    if (!token) fail('login answered without an access_token');

    all = await api(base, '/app-version/releases?includeDeleted=true', { token });
    if (!Array.isArray(all)) fail('the release list is not an array');
  }

  const releases = all
    .map((r) => ({
      platform: r.platform,
      build: r.build,
      version: r.version,
      commit: r.commit ?? null,
      severity: r.severity ?? 'normal',
      notes: r.notes ?? null,
      downloadUrl: r.downloadUrl ?? null,
      releasedAt: r.releasedAt,
      // a release switched inactive is not offered either: ship it as yanked
      isDeleted: r.isDeleted === true || r.isActive === false,
    }))
    .sort((a, b) => a.platform.localeCompare(b.platform) || b.build - a.build);

  const clients = {};
  for (const platform of PLATFORMS) {
    const override = optionalOverride(`${platform.toUpperCase()}_BUILD`);
    const latest = releases.find((r) => r.platform === platform && !r.isDeleted);
    if (override !== null) {
      const match = releases.find((r) => r.platform === platform && r.build === override);
      clients[platform] = { expectedBuild: override, downloadUrl: match?.downloadUrl ?? null };
      console.log(`compat: ${platform} = ${override} (override)`);
    } else if (latest) {
      clients[platform] = { expectedBuild: latest.build, downloadUrl: latest.downloadUrl };
      console.log(`compat: ${platform} = ${latest.build} (latest registered)`);
    } else {
      console.log(`compat: ${platform} = none registered (left out)`);
    }
  }

  const write = (name, value) => {
    writeFileSync(join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
    console.log(`wrote ${join(outDir, name)}`);
  };
  write('build-info.json', { version, build, commit, builtAt: now });
  write('compat.json', { backendBuild: build, generatedAt: now, commit, version, clients });
  write('releases.json', { generatedAt: now, source: base ? 'registry' : 'none', releases });
  console.log(`releases.json: ${releases.length} release(s), ${releases.filter((r) => r.isDeleted).length} yanked`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
