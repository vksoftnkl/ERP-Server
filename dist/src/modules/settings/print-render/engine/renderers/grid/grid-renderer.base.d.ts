import { Logger } from '@nestjs/common';
import { LayoutPage, LayoutTree, Primitive, TextPrimitive } from '../../layout/layout-tree.types';
import { PrinterCommandProfile } from '../renderer.types';
import { Codepage } from './codepage';
import { CellStyle, GridCanvas } from './grid-canvas';
export interface GridConversion {
    readonly canvas: GridCanvas;
    readonly warnings: readonly string[];
}
export declare abstract class GridRendererBase {
    protected readonly logger: Logger;
    protected toCanvas(page: LayoutPage, columns: number, codepage: Codepage): GridConversion;
    private writeText;
    private writeRect;
    protected styleFor(primitive: TextPrimitive): CellStyle;
    protected abstract onGraphicPrimitive(primitive: Primitive, warnings: Set<string>): void;
    protected resolveColumns(tree: LayoutTree, profile: PrinterCommandProfile | null | undefined): number;
    protected resolveCodepage(profile: PrinterCommandProfile | null | undefined): Codepage;
    protected abstract defaultColumns(): number;
}
