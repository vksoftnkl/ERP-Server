export declare const REDACTED = "***";
type Segment = string | number;
export declare function parsePath(path: string): Segment[];
export declare function getPath(root: unknown, path: string): unknown;
export declare function redactPaths(root: unknown, paths: readonly string[]): unknown;
export {};
