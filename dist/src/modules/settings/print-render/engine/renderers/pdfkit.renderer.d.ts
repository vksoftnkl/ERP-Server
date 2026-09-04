import { OutputMode } from '../../definition/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { LayoutTree } from '../layout/layout-tree.types';
import { BarcodeFactory } from './barcode.factory';
import { ImageCache } from './image.cache';
import { IRenderer, RenderOptions, RenderResult } from './renderer.types';
export declare class PdfKitRenderer implements IRenderer {
    private readonly fonts;
    private readonly barcodes;
    private readonly images;
    readonly outputMode: OutputMode;
    private readonly logger;
    constructor(fonts: FontRegistry, barcodes: BarcodeFactory, images: ImageCache);
    render(tree: LayoutTree, options?: RenderOptions): Promise<RenderResult>;
    private registerFonts;
    private contentHeightMm;
    private prepareAssets;
    private drawPage;
    private drawRect;
    private drawLine;
    private drawText;
    private drawTextLine;
    private runWidthPt;
    private drawImage;
    private drawBarcode;
    private drawQrCode;
    private reportOverflow;
}
