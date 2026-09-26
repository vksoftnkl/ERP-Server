#!/usr/bin/env node
/**
 * Generates a TLS certificate for local development.
 *
 * Output: certs/localhost.crt + certs/localhost.key (gitignored).
 *
 * Prefers mkcert, which signs with a CA installed in the local browser trust
 * stores, so browsers show no warning. Falls back to a self-signed openssl cert
 * when mkcert is unavailable — that works, but browsers will warn.
 *
 * To get the trusted path, install mkcert and register its CA:
 *   sudo apt install mkcert libnss3-tools   # or: brew install mkcert nss
 *   mkcert -install
 *
 * Usage: npm run cert:local [-- --force]
 */
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { networkInterfaces } = require('node:os');
const { delimiter, join, resolve } = require('node:path');

const CERT_DIR = resolve(__dirname, '..', 'certs');
const CERT_PATH = join(CERT_DIR, 'localhost.crt');
const KEY_PATH = join(CERT_DIR, 'localhost.key');
const CONFIG_PATH = join(CERT_DIR, 'localhost.openssl.cnf');
const DAYS = 825;

const BASE_HOSTS = ['localhost', '127.0.0.1', '::1'];

const isIpAddress = (host) => /^[\d.]+$/.test(host) || host.includes(':');

// LAN addresses are included so the cert also works when the API is reached
// from another device (or a dev server bound to 0.0.0.0). DHCP can reassign
// these, so they are detected at generation time rather than hardcoded.
const getLanAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);

// Extra names may be supplied as bare args (npm run cert:local -- erp.local)
// or via CERT_HOSTS=a,b for hostnames that are not auto-detectable.
const getExtraHosts = () => [
  ...process.argv.slice(2).filter((arg) => !arg.startsWith('--')),
  ...(process.env.CERT_HOSTS || '').split(',').map((host) => host.trim()),
];

const getHosts = () =>
  Array.from(new Set([...BASE_HOSTS, ...getLanAddresses(), ...getExtraHosts()].filter(Boolean)));

const buildOpensslConfig = (hosts) => {
  let dnsIndex = 0;
  let ipIndex = 0;
  const altNames = hosts
    .map((host) =>
      isIpAddress(host) ? `IP.${++ipIndex}  = ${host}` : `DNS.${++dnsIndex} = ${host}`,
    )
    .join('\n');
  return `[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_req

[dn]
CN = localhost
O  = ERP Server Local Development

[v3_req]
basicConstraints = CA:FALSE
keyUsage         = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[alt_names]
DNS.${++dnsIndex} = *.localhost
${altNames}
`;
};

// mkcert is often installed to a user-local bin that non-login shells miss.
const findMkcert = () => {
  const extraPaths = [join(process.env.HOME || '', '.local', 'bin')];
  const searchPath = [process.env.PATH || '', ...extraPaths].join(delimiter);
  try {
    const found = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['mkcert'], {
      env: { ...process.env, PATH: searchPath },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return found.split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
};

const generateWithMkcert = (mkcertPath, hosts) => {
  execFileSync(mkcertPath, ['-key-file', KEY_PATH, '-cert-file', CERT_PATH, ...hosts], {
    stdio: 'inherit',
  });
  console.log('');
  console.log('Signed by the mkcert local CA — trusted by browsers that have run `mkcert -install`.');
};

const generateWithOpenssl = (hosts) => {
  writeFileSync(CONFIG_PATH, buildOpensslConfig(hosts));
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-nodes',
        '-newkey',
        'rsa:2048',
        '-days',
        String(DAYS),
        '-keyout',
        KEY_PATH,
        '-out',
        CERT_PATH,
        '-config',
        CONFIG_PATH,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
  } finally {
    rmSync(CONFIG_PATH, { force: true });
  }
  console.log(`Generated self-signed certificate (valid ${DAYS} days):`);
  console.log(`  cert: ${CERT_PATH}`);
  console.log(`  key:  ${KEY_PATH}`);
  console.log('');
  console.log('Self-signed: browsers will warn. Install mkcert and re-run for a trusted cert.');
};

const isForced = process.argv.includes('--force');

if (existsSync(CERT_PATH) && existsSync(KEY_PATH) && !isForced) {
  console.log(`Certificate already exists at ${CERT_PATH}. Re-run with --force to regenerate.`);
  process.exit(0);
}

mkdirSync(CERT_DIR, { recursive: true });

const mkcertPath = findMkcert();
const hosts = getHosts();

console.log(`Issuing certificate for: ${hosts.join(', ')}`);

try {
  if (mkcertPath) {
    generateWithMkcert(mkcertPath, hosts);
  } else {
    generateWithOpenssl(hosts);
  }
} catch (error) {
  console.error(`Failed to generate certificate using ${mkcertPath ? 'mkcert' : 'openssl'}.`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log('');
console.log('Enable it in .env:');
console.log('  HTTPS_ENABLED=true');
console.log('  HTTPS_CERT_PATH=certs/localhost.crt');
console.log('  HTTPS_KEY_PATH=certs/localhost.key');
