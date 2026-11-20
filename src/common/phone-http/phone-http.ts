import { createServer, type RequestListener } from 'node:http';
import type { Socket } from 'node:net';
import { Server as TlsServer } from 'node:tls';

/*
 * Phone sync over plain HTTP on the main port (PHONE_HTTP_ENABLED, 2026-11-18).
 *
 * The salesman phones can't trust this PC's self-made certificate, so they sync over plain
 * HTTP. They now use the same port as the desktop and web clients (3011 on the dev box),
 * which replaces the separate MOBILE_HTTP_PORT (3012).
 *
 * How one port speaks both: every TLS connection opens with a handshake record whose first
 * byte is 0x16, and a plain HTTP request starts with a method name (`GET`, `POST`, ...).
 * The main HTTPS server reads each new connection's first byte. A TLS connection goes to
 * the normal HTTPS path. A plain connection goes to a plain HTTP server that runs the same
 * Express app, but only for the phone's routes. Every other route is a 404 over plain HTTP,
 * so the desktop and web clients stay on HTTPS.
 *
 * Add a route here when the phone's Sync starts calling it.
 */
// The ledger pair (VKSMAN Sync downloads each customer's Ledger Statement, 2026-11-16): both still
// need a token, and the statement needs the menu-258 view right, as on the desktop.
export const PHONE_HTTP_ROUTES = ['health', 'auth/login', 'reports/ledger-statement/vouchers'];
export const PHONE_HTTP_ROUTE_PREFIXES = ['mobile/', 'master-lookups/fiscal-years/by-company/'];

export const isPhoneHttpRoute = (url: string, apiBase: string): boolean => {
  const path = url.split('?')[0] ?? '';
  // No dot segments or encoded characters: the path is matched as written.
  if (path.includes('%') || /(^|\/)\.\.?(\/|$)/.test(path) || !path.startsWith(apiBase)) {
    return false;
  }
  const route = path.slice(apiBase.length);
  return (
    PHONE_HTTP_ROUTES.includes(route) || PHONE_HTTP_ROUTE_PREFIXES.some((p) => route.startsWith(p))
  );
};

/** The phone routes only. Every other plain-HTTP request gets a 404 that says to use HTTPS. */
export const phoneRoutesOnly =
  (app: RequestListener, apiBase: string): RequestListener =>
  (req, res) => {
    if (isPhoneHttpRoute(req.url ?? '', apiBase)) {
      app(req, res);
      return;
    }
    const message = 'Not available over plain HTTP. Use https:// for this route.';
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        statusCode: 404,
        message,
        errors: [{ field: 'request', code: 'HTTP_404', message }],
        path: req.url ?? '',
      }),
    );
  };

const TLS_HANDSHAKE_RECORD = 0x16;
// Same as tls.Server's own handshakeTimeout: a connection that never sends a byte is dropped.
const FIRST_BYTE_TIMEOUT_MS = 120_000;

type ConnectionListener = (this: TlsServer, socket: Socket) => void;

/*
 * Node registers one shared module-level function as the 'connection' listener of every
 * tls.Server. A throwaway server (never listened on, so it holds no handle) gives us that
 * function to compare against.
 */
const nodeTlsConnectionListener = (): ConnectionListener | undefined =>
  new TlsServer().listeners('connection')[0] as ConnectionListener | undefined;

/**
 * Makes `server` (the main HTTPS server, before it listens) also answer plain HTTP with
 * `onPlainRequest`. Returns false, and changes nothing, if Node's TLS listener can't be found
 * on the server. That would mean the Node internals changed, and the port stays HTTPS-only.
 *
 * Every other 'connection' listener still sees every socket. That includes Nest's
 * forceCloseConnections tracker, so a shutdown also destroys plain and undecided connections,
 * and `nest start --watch` never waits on a phone's keep-alive socket.
 */
export function servePlainHttpOnTlsServer(
  server: TlsServer,
  onPlainRequest: RequestListener,
): boolean {
  const tlsListener = nodeTlsConnectionListener();
  const listeners = server.listeners('connection') as ConnectionListener[];
  if (!tlsListener || !listeners.includes(tlsListener)) {
    return false;
  }
  const otherListeners = listeners.filter((listener) => listener !== tlsListener);
  const plainServer = createServer(onPlainRequest);
  server.removeAllListeners('connection');
  server.on('connection', (socket: Socket) => {
    for (const listener of otherListeners) {
      listener.call(server, socket);
    }
    // Until the TLS or HTTP layer owns the socket, nothing else would catch a reset.
    socket.on('error', () => socket.destroy());
    const dropIdle = () => socket.destroy();
    socket.setTimeout(FIRST_BYTE_TIMEOUT_MS);
    socket.once('timeout', dropIdle);
    socket.once('data', (chunk: Buffer) => {
      socket.setTimeout(0);
      socket.removeListener('timeout', dropIdle);
      // Put the bytes back, so the layer that takes the socket reads them as the first bytes.
      socket.pause();
      socket.unshift(chunk);
      if (chunk[0] === TLS_HANDSHAKE_RECORD) {
        tlsListener.call(server, socket);
      } else {
        plainServer.emit('connection', socket);
      }
      process.nextTick(() => socket.resume());
    });
  });
  return true;
}
