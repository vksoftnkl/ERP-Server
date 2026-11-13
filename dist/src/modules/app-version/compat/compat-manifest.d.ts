import { type ClientPlatform } from '../../../common/client-info/client-info';
export interface CompatManifestEntry {
    expectedBuild: number | null;
    message: string | null;
    downloadUrl: string | null;
}
export interface CompatManifest {
    path: string;
    backendBuild: number | null;
    clients: Record<ClientPlatform, CompatManifestEntry>;
}
export type CompatManifestResult = {
    ok: true;
    manifest: CompatManifest;
} | {
    ok: false;
    path: string | null;
    reason: string;
};
export declare function loadCompatManifest(appBuild: number, env?: NodeJS.ProcessEnv, startDir?: string): CompatManifestResult;
export declare function parseCompatManifest(raw: unknown, appBuild: number, path: string): CompatManifestResult;
export declare function isBuildNumber(value: unknown): value is number;
