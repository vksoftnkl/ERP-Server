import { type ClientPlatform } from '../../../common/client-info/client-info';
import { type ReleaseSeverity } from '../app-version.constants';
export interface ReleaseImport {
    platform: ClientPlatform;
    build: number;
    version: string;
    commit: string | null;
    severity: ReleaseSeverity;
    notes: string | null;
    downloadUrl: string | null;
    releasedAt: string;
    isDeleted: boolean;
}
export interface ReleaseList {
    path: string;
    releases: ReleaseImport[];
}
export type ReleaseListResult = {
    ok: true;
    list: ReleaseList;
} | {
    ok: false;
    path: string | null;
    reason: string;
};
export declare function loadReleaseList(env?: NodeJS.ProcessEnv, startDir?: string): ReleaseListResult;
export declare function parseReleaseList(raw: unknown, path: string): ReleaseListResult;
