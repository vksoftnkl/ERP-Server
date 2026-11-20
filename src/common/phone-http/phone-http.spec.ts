import { get as httpGet, createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer, get as httpsGet } from 'node:https';
import { connect, type AddressInfo, type Socket } from 'node:net';
import type { Server as TlsServer } from 'node:tls';
import { isPhoneHttpRoute, phoneRoutesOnly, servePlainHttpOnTlsServer } from './phone-http';

// Throwaway self-signed certificate for localhost, used only by this spec. It is not a secret.
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIBnDCCAUGgAwIBAgIUYtUmsPGyb/lqed+88eQKdhdBTDgwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTExODA3NTIwM1oYDzIxMjYxMDI1
MDc1MjAzWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAAS0Q6yyuwDBXQd0GlAKPoDVIwKXw94K9vqNuJR8og41XY5j1ExEG8wP
s5u1QHN5J2AIkwLTPclzhtUtULdWOpWXo28wbTAdBgNVHQ4EFgQUfLpxqL/4LH/L
t9XbSYVkfLsZyJcwHwYDVR0jBBgwFoAUfLpxqL/4LH/Lt9XbSYVkfLsZyJcwDwYD
VR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgglsb2NhbGhvc3SHBH8AAAEwCgYIKoZI
zj0EAwIDSQAwRgIhAPJVzgXFQhFjP6qRsOyvCbEOBH6XV3K3z1VUYmOAf2LdAiEA
wlh5KXNoqD7A07Go5OVeZIW3RI0qwIpAp5KOQ/UQBXg=
-----END CERTIFICATE-----`;
const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQggHNG1NUJjaRgRwcm
GHEIFbeMvaFxLY2x9zfZpMYaXkqhRANCAAS0Q6yyuwDBXQd0GlAKPoDVIwKXw94K
9vqNuJR8og41XY5j1ExEG8wPs5u1QHN5J2AIkwLTPclzhtUtULdWOpWX
-----END PRIVATE KEY-----`;

const API = '/api/v1/';

describe('isPhoneHttpRoute', () => {
  it.each([
    ['/api/v1/health', true],
    ['/api/v1/auth/login', true],
    ['/api/v1/mobile/orders/list?page=1', true],
    ['/api/v1/reports/ledger-statement/vouchers', true],
    ['/api/v1/master-lookups/fiscal-years/by-company/abc', true],
    ['/api/v1/sale-bills/list', false],
    ['/api/v1/mobile/../users/list', false],
    ['/api/v1/mobile/%2e%2e/users', false],
    ['/api/v2/health', false],
  ])('%s -> %s', (url, expected) => {
    expect(isPhoneHttpRoute(url, API)).toBe(expected);
  });
});

type Reply = { status: number; body: string };

const read = (res: import('node:http').IncomingMessage): Promise<Reply> =>
  new Promise((resolve, reject) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (part: string) => (body += part));
    res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    res.on('error', reject);
  });

describe('servePlainHttpOnTlsServer', () => {
  let server: TlsServer;
  let port: number;
  const tracked = new Set<Socket>();

  beforeEach(async () => {
    const app = (
      req: import('node:http').IncomingMessage,
      res: import('node:http').ServerResponse,
    ) => res.end(`${req.socket.constructor.name === 'TLSSocket' ? 'TLS' : 'PLAIN'} ${req.url}`);
    server = createHttpsServer({ cert: TEST_CERT, key: TEST_KEY }, app);
    // Stands in for Nest's forceCloseConnections tracker, which is registered at create time.
    server.on('connection', (socket: Socket) => {
      tracked.add(socket);
      socket.on('close', () => tracked.delete(socket));
    });
    expect(servePlainHttpOnTlsServer(server, phoneRoutesOnly(app, API))).toBe(true);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const socket of tracked) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const viaHttps = (path: string) =>
    new Promise<Reply>((resolve, reject) =>
      httpsGet({ host: '127.0.0.1', port, path, ca: TEST_CERT, servername: 'localhost' }, (res) =>
        read(res).then(resolve, reject),
      ).on('error', reject),
    );
  const viaHttp = (path: string) =>
    new Promise<Reply>((resolve, reject) =>
      httpGet({ host: '127.0.0.1', port, path }, (res) => read(res).then(resolve, reject)).on(
        'error',
        reject,
      ),
    );

  it('answers HTTPS on every route, as before', async () => {
    await expect(viaHttps('/api/v1/sale-bills/list')).resolves.toEqual({
      status: 200,
      body: 'TLS /api/v1/sale-bills/list',
    });
  });

  it('answers plain HTTP on the phone routes on the same port', async () => {
    await expect(viaHttp('/api/v1/mobile/orders/list')).resolves.toEqual({
      status: 200,
      body: 'PLAIN /api/v1/mobile/orders/list',
    });
  });

  it('refuses plain HTTP on any other route with HTTP_404', async () => {
    const reply = await viaHttp('/api/v1/sale-bills/list');
    expect(reply.status).toBe(404);
    expect(JSON.parse(reply.body).errors[0].code).toBe('HTTP_404');
  });

  it('lets the tracker see plain and silent sockets, so a shutdown can close them', async () => {
    const silent = connect(port, '127.0.0.1');
    await new Promise((resolve) => silent.once('connect', resolve));
    await viaHttp('/api/v1/health');
    await new Promise((resolve) => setImmediate(resolve));
    const remotePorts = [...tracked].map((socket) => socket.remotePort);
    // The silent socket has sent no byte, so neither TLS nor HTTP owns it yet.
    expect(remotePorts).toContain(silent.localPort);
    silent.destroy();
  });

  it('changes nothing on a server without the TLS listener', () => {
    const plain = createHttpServer() as unknown as TlsServer;
    const before = plain.listeners('connection');
    expect(servePlainHttpOnTlsServer(plain, () => undefined)).toBe(false);
    expect(plain.listeners('connection')).toEqual(before);
  });
});
