import { TemplateDefinition } from '../../templates/dto/template-definition.schema';
import { LayoutTree } from './layout-tree.types';
import { TextMeasurer } from './text-measure';
export interface RenderDatasets {
    readonly [name: string]: unknown;
}
export interface LayoutInput {
    readonly definition: TemplateDefinition;
    readonly datasets: RenderDatasets;
    readonly ctx: Record<string, unknown>;
    readonly sys?: Record<string, unknown>;
}
export declare class LayoutEngine {
    private readonly measurer;
    constructor(measurer: TextMeasurer);
    render(input: LayoutInput): LayoutTree;
}
