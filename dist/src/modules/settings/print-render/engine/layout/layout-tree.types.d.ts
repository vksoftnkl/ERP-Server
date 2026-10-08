import { BarcodeSymbology, HorizontalAlign, PaperSpec, VerticalAlign } from '../../definition/template-definition.schema';
export interface FontSpecResolved {
    readonly family: string;
    readonly sizePt: number;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly underline: boolean;
}
export interface TextPrimitive {
    readonly k: 'text';
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly text: string;
    readonly font: FontSpecResolved;
    readonly align: HorizontalAlign;
    readonly vAlign: VerticalAlign;
    readonly color: string;
    readonly lines: readonly string[];
    readonly lineHeightMm: number;
}
export interface LinePrimitive {
    readonly k: 'line';
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly widthPt: number;
    readonly color: string;
    readonly gridChar: string;
}
export interface RectPrimitive {
    readonly k: 'rect';
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly fill: string | null;
    readonly stroke: string | null;
    readonly strokeWidthPt: number;
    readonly radiusMm: number;
}
export interface ImagePrimitive {
    readonly k: 'image';
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly src: string;
    readonly fit: 'CONTAIN' | 'COVER' | 'STRETCH';
}
export interface BarcodePrimitive {
    readonly k: 'barcode';
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly symbology: BarcodeSymbology;
    readonly value: string;
    readonly showText: boolean;
}
export interface QrCodePrimitive {
    readonly k: 'qrcode';
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly value: string;
    readonly errorCorrection: 'L' | 'M' | 'Q' | 'H';
}
export type Primitive = TextPrimitive | LinePrimitive | RectPrimitive | ImagePrimitive | BarcodePrimitive | QrCodePrimitive;
export interface LayoutPage {
    readonly index: number;
    readonly primitives: Primitive[];
}
export interface LayoutWarning {
    readonly kind: 'expression' | 'overflow' | 'missing-dataset' | 'band-too-tall' | 'row-limit' | 'page-limit';
    readonly message: string;
    readonly detail?: string;
}
export interface LayoutTree {
    readonly pageCount: number;
    readonly paper: PaperSpec;
    readonly layoutMode: 'GRAPHIC' | 'GRID';
    readonly pages: readonly LayoutPage[];
    readonly warnings: readonly LayoutWarning[];
    readonly stats: {
        readonly detailRows: number;
        readonly bandsEmitted: number;
        readonly durationMs: number;
    };
}
