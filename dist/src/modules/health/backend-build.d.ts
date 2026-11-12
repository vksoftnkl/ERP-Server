export interface BackendBuild {
    version: string;
    build: number | null;
    commit: string | null;
}
export declare function backendBuild(): BackendBuild;
export declare function resolveBackendBuild(env: NodeJS.ProcessEnv, startDir?: string): BackendBuild;
