import type { IncomingHttpHeaders } from 'node:http';
export declare const CLIENT_PLATFORMS: readonly ["web", "desktop", "mobile"];
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];
export declare const CLIENT_INFO_HEADERS: {
    readonly platform: "x-app-platform";
    readonly build: "x-app-build";
    readonly version: "x-app-version";
    readonly commit: "x-app-commit";
    readonly deviceId: "x-device-id";
    readonly deviceOs: "x-device-os";
};
export declare const MAX_CLIENT_BUILD = 2147483647;
export interface ClientInfo {
    platform: ClientPlatform | null;
    build: number | null;
    version: string | null;
    commit: string | null;
    deviceId: string | null;
    deviceOs: string | null;
}
export type IdentifiedClientInfo = ClientInfo & {
    platform: ClientPlatform;
    build: number;
};
export declare const EMPTY_CLIENT_INFO: Readonly<ClientInfo>;
export type RequestWithClientInfo = {
    headers: IncomingHttpHeaders;
    clientInfo?: ClientInfo;
};
export declare function parseClientInfo(headers: IncomingHttpHeaders | undefined | null): ClientInfo;
export declare function clientInfoOf(request: unknown): ClientInfo;
export declare function hasClientBuild(info: ClientInfo | null | undefined): info is IdentifiedClientInfo;
export declare function parsePlatform(value: string | null): ClientPlatform | null;
export declare function parseClientBuild(value: string | null): number | null;
