import { Readable } from 'node:stream';
import { OutputMode } from '../../definition/template-definition.schema';
import { LayoutTree } from '../layout/layout-tree.types';
export interface RenderOptions {
    readonly printerProfile?: PrinterCommandProfile | null;
    readonly resolveImage?: (source: string) => Promise<Buffer | null>;
    readonly timeoutMs?: number;
    readonly creationDate?: Date;
}
export interface RenderResult {
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly extension: string;
    readonly pageCount: number;
    readonly durationMs: number;
    readonly warnings: readonly string[];
}
export interface IRenderer {
    readonly outputMode: OutputMode;
    render(tree: LayoutTree, options?: RenderOptions): Promise<RenderResult>;
}
export interface PrinterCommandProfile {
    readonly code: string;
    readonly name: string;
    readonly family: string;
    readonly columns: number;
    readonly cpi: number | null;
    readonly paperWidthMm: number | null;
    readonly codepage: string;
    readonly supportsBold: boolean;
    readonly supportsUnderline: boolean;
    readonly supportsCut: boolean;
    readonly supportsGraphics: boolean;
    readonly commands: Readonly<Record<string, Buffer>>;
}
export declare const toStream: (bytes: Buffer) => Readable;
