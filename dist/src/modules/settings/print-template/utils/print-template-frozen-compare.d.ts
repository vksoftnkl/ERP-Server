export declare function jsonDeepEqual(a: unknown, b: unknown): boolean;
export type CompareKind = 'text' | 'number' | 'json' | 'body';
export declare function sentValueDiffers(kind: CompareKind, sent: unknown, stored: unknown): boolean;
export declare const VERSION_DESIGN_COMPARE: Record<string, CompareKind>;
export declare function changedVersionKeys(row: object, stored: object, sentKeys: string[]): string[];
export declare const DATASET_COMPARE: Record<string, CompareKind>;
export declare function datasetsDifference(sent: object[], stored: object[]): string | null;
