export type ScriptTag = 'tamil' | 'latin';
export interface ScriptRun {
    readonly script: ScriptTag;
    readonly text: string;
}
export declare const isTamilCodePoint: (codePoint: number) => boolean;
export declare const splitScriptRuns: (text: string) => ScriptRun[];
export declare const containsComplexScript: (text: string) => boolean;
