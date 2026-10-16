import { type GstRoute } from './gst-route-guard';
export interface GstHttpRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
    route: GstRoute;
}
export interface GstHttpResponse {
    status: number;
    text: string;
}
export declare class GstHttpError extends Error {
    readonly kind: 'TIMEOUT' | 'NETWORK';
    constructor(kind: 'TIMEOUT' | 'NETWORK', message: string);
}
export declare class GstHttpClient {
    send(request: GstHttpRequest): Promise<GstHttpResponse>;
}
