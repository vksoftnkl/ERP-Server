import { BarcodeSymbology } from '../../templates/dto/template-definition.schema';
export interface GeneratedImage {
    readonly png: Buffer;
    readonly widthPx: number;
    readonly heightPx: number;
}
export declare class BarcodeFactory {
    private readonly logger;
    private readonly cache;
    private readonly warnings;
    drainWarnings(): string[];
    barcode(symbology: BarcodeSymbology, value: string, widthMm: number, heightMm: number, showText: boolean): Promise<GeneratedImage | null>;
    qrcode(value: string, sizeMm: number, errorCorrection: 'L' | 'M' | 'Q' | 'H'): Promise<GeneratedImage | null>;
    private validate;
    private store;
}
