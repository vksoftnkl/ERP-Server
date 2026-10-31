export type CodepageName = 'CP437' | 'CP850' | 'CP1252' | 'ASCII';
export interface EncodeResult {
    readonly bytes: Buffer;
    readonly unmapped: readonly string[];
}
export declare class Codepage {
    readonly name: CodepageName;
    private readonly reverse;
    constructor(name: CodepageName);
    encode(text: string): EncodeResult;
    covers(text: string): boolean;
    static prepare(text: string): string;
}
export declare const getCodepage: (name: string | null | undefined) => Codepage;
export declare const findUnprintableScripts: (text: string) => string[];
