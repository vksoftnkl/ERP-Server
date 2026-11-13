export declare const PACKAGE_FILES: {
    readonly buildInfo: "build-info.json";
    readonly compat: "compat.json";
    readonly releases: "releases.json";
};
export type PackageFileName = (typeof PACKAGE_FILES)[keyof typeof PACKAGE_FILES];
export type PackageFileRead = {
    found: true;
    path: string;
    json: unknown;
} | {
    found: false;
    path: string | null;
    reason: string;
};
export declare function locatePackageFile(name: string, env?: NodeJS.ProcessEnv, startDir?: string, execPath?: string | null): string | null;
export declare function readPackageFile(name: string, env?: NodeJS.ProcessEnv, startDir?: string): PackageFileRead;
export declare function packageRoot(startDir: string): string | null;
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
