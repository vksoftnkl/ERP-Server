import { FontSpecResolved, RichRun } from './layout-tree.types';
import { MeasuredFont, TextMeasurer } from './text-measure';
export interface MarkupStyle {
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly underline?: boolean;
    readonly strikeout?: boolean;
    readonly color?: string;
    readonly sizePt?: number;
    readonly shift?: 'sup' | 'sub';
}
export interface MarkupSegment {
    readonly template: string;
    readonly style: MarkupStyle;
}
export interface StyledText {
    readonly text: string;
    readonly font: FontSpecResolved;
    readonly color: string;
    readonly shift?: 'sup' | 'sub';
}
export declare const SHIFT_SCALE = 0.7;
export declare function decodeEntities(text: string): string;
export declare function parseMarkup(template: string): MarkupSegment[];
export declare const hasMarkup: (template: string) => boolean;
export interface RichLayout {
    readonly lines: RichRun[][];
    readonly plain: string[];
    readonly justify: boolean[];
    readonly lineHeightMm: number;
}
export declare function layoutRich(runs: readonly StyledText[], maxWidthMm: number, wrap: boolean, measurer: TextMeasurer, baseFont: MeasuredFont): RichLayout;
