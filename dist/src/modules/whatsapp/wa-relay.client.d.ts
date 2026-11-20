import { WaRelayError } from './wa-errors';
export interface RelayConnection {
    shopCode: string;
    installId: string | null;
    state: string;
    displayName: string | null;
    displayPhone: string | null;
    wabaId: string | null;
    phoneNumberId: string | null;
    qualityRating: string | null;
    messagingLimit: number | null;
    coexistence?: boolean | null;
    connectedOn: string | null;
    serverTime: string | null;
    templates: RelayTemplate[];
}
export interface RelayTemplate {
    name: string;
    lang: string;
    purpose: string;
    category: string | null;
    status: string;
    reason: string | null;
    body: string | null;
    params: string[];
    headerKind: string;
    buttons: unknown[];
    statusOn: string | null;
}
export interface RelayEvent {
    id: number;
    kind: 'STATUS' | 'TAP' | 'STOP' | 'TEMPLATE' | 'ACCOUNT' | string;
    clientRef: string | null;
    wamid: string | null;
    status: string | null;
    at: string | null;
    metaErrorCode: number | null;
    metaErrorTitle: string | null;
    reply: string | null;
    fromPhone: string | null;
    detail: Record<string, unknown> | null;
}
export interface RelaySendMeta {
    clientRef: string;
    to: string;
    templateName: string;
    lang: string;
    params: Record<string, string>;
    documentFilename?: string;
}
export interface RelaySendResult {
    relayMsgId: string;
    wamid: string | null;
    acceptedAt: string;
    duplicate: boolean;
}
type FetchFn = typeof fetch;
export declare class WaRelayClient {
    fetchFn: FetchFn;
    configuredUrl(): string | null;
    activate(baseUrl: string, body: {
        activationCode: string;
        installLabel: string | null;
        erpVersion: string | null;
    }): Promise<{
        shopCode: string;
        installId: string;
        apiKey: string;
        keyPrefix: string;
    }>;
    connection(baseUrl: string, key: string): Promise<RelayConnection>;
    connectCode(baseUrl: string, key: string, body: {
        requestedBy: string;
        shopInfo: Record<string, string | null>;
    }): Promise<{
        code: string;
        url: string;
        expiresAt: string;
    }>;
    events(baseUrl: string, key: string, after: bigint | number, limit?: number): Promise<{
        events: RelayEvent[];
        more: boolean;
    }>;
    ack(baseUrl: string, key: string, upTo: number): Promise<{
        acked: number;
    }>;
    rotate(baseUrl: string, key: string): Promise<{
        apiKey: string;
        keyPrefix: string;
        oldKeyValidUntil: string;
    }>;
    disconnect(baseUrl: string, key: string, body: {
        requestedBy: string;
        reason: string | null;
    }): Promise<{
        state: string;
    }>;
    send(baseUrl: string, key: string, meta: RelaySendMeta, pdf: {
        bytes: Buffer;
        filename: string;
    } | null): Promise<RelaySendResult>;
    healthy(baseUrl: string): Promise<boolean>;
    private json;
    private request;
}
export declare function mapRelayFailure(httpStatus: number, body: unknown, rawText?: string): WaRelayError;
export {};
