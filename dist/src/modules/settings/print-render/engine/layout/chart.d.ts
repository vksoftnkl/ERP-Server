import { ChartElement } from '../../definition/template-definition.schema';
import { Primitive } from './layout-tree.types';
import { TextMeasurer } from './text-measure';
export declare const CHART_PALETTE: string[];
export interface ChartEnvironment {
    readonly measurer: TextMeasurer;
    evaluate(template: string, context: Record<string, unknown>): unknown;
    evaluateText(template: string, context: Record<string, unknown>): string;
    resolveColour(value: string | undefined, context: Record<string, unknown>, fallback: string): string;
    rowContext(row: unknown, index: number, total: number): Record<string, unknown>;
}
export interface ChartData {
    readonly categories: string[];
    readonly values: (number | null)[][];
    readonly droppedCategories: number;
}
export declare function aggregateChart(element: ChartElement, rows: readonly unknown[], env: ChartEnvironment): ChartData;
export declare function niceStep(span: number, target?: number): number;
export interface ChartBuild {
    readonly primitives: Primitive[];
    readonly warnings: string[];
}
export declare function buildChart(element: ChartElement, rows: readonly unknown[], context: Record<string, unknown>, xMm: number, yMm: number, env: ChartEnvironment): ChartBuild;
