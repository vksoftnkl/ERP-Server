"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneRoutesOnly = exports.isPhoneHttpRoute = exports.PHONE_HTTP_ROUTE_PREFIXES = exports.PHONE_HTTP_ROUTES = void 0;
exports.servePlainHttpOnTlsServer = servePlainHttpOnTlsServer;
const node_http_1 = require("node:http");
const node_tls_1 = require("node:tls");
exports.PHONE_HTTP_ROUTES = ['health', 'auth/login', 'reports/ledger-statement/vouchers'];
exports.PHONE_HTTP_ROUTE_PREFIXES = ['mobile/', 'master-lookups/fiscal-years/by-company/'];
const isPhoneHttpRoute = (url, apiBase) => {
    const path = url.split('?')[0] ?? '';
    if (path.includes('%') || /(^|\/)\.\.?(\/|$)/.test(path) || !path.startsWith(apiBase)) {
        return false;
    }
    const route = path.slice(apiBase.length);
    return (exports.PHONE_HTTP_ROUTES.includes(route) || exports.PHONE_HTTP_ROUTE_PREFIXES.some((p) => route.startsWith(p)));
};
exports.isPhoneHttpRoute = isPhoneHttpRoute;
const phoneRoutesOnly = (app, apiBase) => (req, res) => {
    if ((0, exports.isPhoneHttpRoute)(req.url ?? '', apiBase)) {
        app(req, res);
        return;
    }
    const message = 'Not available over plain HTTP. Use https:// for this route.';
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        statusCode: 404,
        message,
        errors: [{ field: 'request', code: 'HTTP_404', message }],
        path: req.url ?? '',
    }));
};
exports.phoneRoutesOnly = phoneRoutesOnly;
const TLS_HANDSHAKE_RECORD = 0x16;
const FIRST_BYTE_TIMEOUT_MS = 120_000;
const nodeTlsConnectionListener = () => new node_tls_1.Server().listeners('connection')[0];
function servePlainHttpOnTlsServer(server, onPlainRequest) {
    const tlsListener = nodeTlsConnectionListener();
    const listeners = server.listeners('connection');
    if (!tlsListener || !listeners.includes(tlsListener)) {
        return false;
    }
    const otherListeners = listeners.filter((listener) => listener !== tlsListener);
    const plainServer = (0, node_http_1.createServer)(onPlainRequest);
    server.removeAllListeners('connection');
    server.on('connection', (socket) => {
        for (const listener of otherListeners) {
            listener.call(server, socket);
        }
        socket.on('error', () => socket.destroy());
        const dropIdle = () => socket.destroy();
        socket.setTimeout(FIRST_BYTE_TIMEOUT_MS);
        socket.once('timeout', dropIdle);
        socket.once('data', (chunk) => {
            socket.setTimeout(0);
            socket.removeListener('timeout', dropIdle);
            socket.pause();
            socket.unshift(chunk);
            if (chunk[0] === TLS_HANDSHAKE_RECORD) {
                tlsListener.call(server, socket);
            }
            else {
                plainServer.emit('connection', socket);
            }
            process.nextTick(() => socket.resume());
        });
    });
    return true;
}
//# sourceMappingURL=phone-http.js.map