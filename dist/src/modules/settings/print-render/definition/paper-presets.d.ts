export interface PaperPreset {
    readonly code: string;
    readonly label: string;
    readonly widthMm: number;
    readonly heightMm: number | null;
    readonly layoutMode: 'GRAPHIC' | 'GRID';
    readonly columns?: number;
    readonly rows?: number;
    readonly cpi?: number;
}
export declare const PAPER_PRESETS: readonly PaperPreset[];
export declare const findPaperPreset: (code: string | null | undefined) => PaperPreset | undefined;
export declare const DEFAULT_PAPER: PaperPreset;
