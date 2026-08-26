import { OutputMode } from '../../../templates/dto/template-definition.schema';
import { LayoutTree, Primitive } from '../../layout/layout-tree.types';
import { IRenderer, RenderOptions, RenderResult } from '../renderer.types';
import { GridRendererBase } from './grid-renderer.base';
export declare class EscPRenderer extends GridRendererBase implements IRenderer {
    readonly outputMode: OutputMode;
    render(tree: LayoutTree, options?: RenderOptions): Promise<RenderResult>;
    protected defaultColumns(): number;
    protected onGraphicPrimitive(primitive: Primitive, warnings: Set<string>): void;
    private pitchCommand;
    private encodeRow;
}
