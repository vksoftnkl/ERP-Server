import { type RequestListener } from 'node:http';
import { Server as TlsServer } from 'node:tls';
export declare const PHONE_HTTP_ROUTES: string[];
export declare const PHONE_HTTP_ROUTE_PREFIXES: string[];
export declare const isPhoneHttpRoute: (url: string, apiBase: string) => boolean;
export declare const phoneRoutesOnly: (app: RequestListener, apiBase: string) => RequestListener;
export declare function servePlainHttpOnTlsServer(server: TlsServer, onPlainRequest: RequestListener): boolean;
