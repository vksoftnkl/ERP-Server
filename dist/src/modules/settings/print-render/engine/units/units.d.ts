export declare const POINTS_PER_MM: number;
export declare const PIXELS_PER_MM: number;
export declare const MM_PER_INCH = 25.4;
export declare const mmToPoints: (millimetres: number) => number;
export declare const pointsToMm: (points: number) => number;
export declare const mmToPixels: (millimetres: number) => number;
export declare const pixelsToMm: (pixels: number) => number;
export declare const mmToInches: (millimetres: number) => number;
export declare const cpiToCellWidthMm: (charactersPerInch: number) => number;
export declare const lpiToLineHeightMm: (linesPerInch: number) => number;
export declare const roundMm: (millimetres: number) => number;
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
export declare const findPaperPreset: (code: string) => PaperPreset | undefined;
