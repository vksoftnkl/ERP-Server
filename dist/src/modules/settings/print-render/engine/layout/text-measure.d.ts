import { FontRegistry } from '../fonts/font.registry';
export interface MeasuredFont {
    readonly family: string;
    readonly sizePt: number;
    readonly bold: boolean;
    readonly italic: boolean;
}
export interface WrappedText {
    readonly lines: readonly string[];
    readonly widthMm: number;
    readonly heightMm: number;
    readonly lineHeightMm: number;
}
export declare class TextMeasurer {
    private readonly fonts;
    private readonly widthCache;
    constructor(fonts: FontRegistry);
    measureWidthMm(text: string, font: MeasuredFont): number;
    lineHeightMm(font: MeasuredFont): number;
    ascentMm(font: MeasuredFont): number;
    wrap(text: string, maxWidthMm: number, font: MeasuredFont): WrappedText;
    truncateToWidth(text: string, maxWidthMm: number, font: MeasuredFont, ellipsis?: string): string;
    clearCache(): void;
    private wrapParagraph;
    private breakLongWord;
    private measureRunPoints;
    private lineHeightPoints;
}
export declare const MM_PER_POINT: number;
