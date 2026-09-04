import { AGGREGATE_FUNCTIONS, CrosstabElement } from '../../definition/template-definition.schema';
import { Primitive } from './layout-tree.types';
import { MeasuredFont } from './text-measure';
type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number];
export declare const CROSSTAB_FOLD_KEY = "\u001Fcrosstab-fold";
export declare const CROSSTAB_TOTALS_KEY = "\u001Fcrosstab-total";
export interface CrosstabAxisLevel {
    readonly expression: string;
    readonly label: string;
    readonly widthMm: number;
}
export interface CrosstabMeasureSpec {
    readonly expression: string;
    readonly label: string;
    readonly fn: AggregateFunction;
    readonly format: string;
    readonly blankWhenZero: boolean;
}
export declare const crosstabRowAxes: (element: CrosstabElement) => CrosstabAxisLevel[];
export declare const crosstabColumnAxes: (element: CrosstabElement) => CrosstabAxisLevel[];
export declare const crosstabMeasures: (element: CrosstabElement) => CrosstabMeasureSpec[];
export interface CrosstabLeafColumn {
    readonly key: string;
    readonly labels: readonly string[];
    readonly label: string;
}
export interface CrosstabColumn {
    readonly key: string;
    readonly label: string;
    readonly leafIndex: number;
    readonly measureIndex: number;
}
export interface CrosstabModelRow {
    readonly key: string;
    readonly labels: readonly string[];
    readonly label: string;
    readonly values: readonly (number | null)[];
    readonly totals: readonly (number | null)[];
    readonly total: number | null;
}
export interface CrosstabModel {
    readonly rowAxes: readonly CrosstabAxisLevel[];
    readonly columnAxes: readonly CrosstabAxisLevel[];
    readonly measures: readonly CrosstabMeasureSpec[];
    readonly leaves: readonly CrosstabLeafColumn[];
    readonly columns: readonly CrosstabColumn[];
    readonly rows: readonly CrosstabModelRow[];
    readonly columnTotals: readonly (number | null)[];
    readonly grandTotals: readonly (number | null)[];
    readonly grandTotal: number | null;
    readonly sourceRows: number;
    readonly droppedColumns: number;
}
export interface CrosstabRowReader {
    text(expression: string, row: unknown, index: number, total: number): string;
    number(expression: string, row: unknown, index: number, total: number): number;
}
export declare function buildCrosstabModel(element: CrosstabElement, rows: readonly unknown[], reader: CrosstabRowReader): CrosstabModel;
export interface PlannedRowColumn {
    readonly xMm: number;
    readonly wMm: number;
    readonly label: string;
    readonly levelIndex: number;
}
export interface PlannedColumn {
    readonly key: string;
    readonly label: string;
    readonly xMm: number;
    readonly wMm: number;
    readonly modelIndex: number | null;
    readonly leafIndex: number | null;
    readonly measureIndex: number;
}
export interface CrosstabPlan {
    readonly element: CrosstabElement;
    readonly model: CrosstabModel;
    readonly rowHeaderWidthMm: number;
    readonly rowColumns: readonly PlannedRowColumn[];
    readonly columns: readonly PlannedColumn[];
    readonly headerRowHeightMm: number;
    readonly headerRowCount: number;
    readonly headerHeightMm: number;
    readonly rowHeightMm: number;
    readonly totalsRowHeightMm: number;
    readonly fullHeightMm: number;
    readonly bodyFont: MeasuredFont;
    readonly headerFont: MeasuredFont;
    readonly measurer: CrosstabMeasurer;
    readonly columnsCutForWidth: number;
}
export interface CrosstabMeasurer {
    truncateToWidth(text: string, maxWidthMm: number, font: MeasuredFont, ellipsis?: string): string;
    lineHeightMm(font: MeasuredFont): number;
}
export declare function planCrosstab(element: CrosstabElement, model: CrosstabModel, measurer: CrosstabMeasurer): CrosstabPlan;
export interface CrosstabSlice {
    readonly fromRow: number;
    readonly rowCount: number;
    readonly withHeader: boolean;
    readonly withTotals: boolean;
    readonly heightMm: number;
}
export declare function sliceCrosstab(plan: CrosstabPlan, fromRow: number, availableMm: number, withHeader: boolean): CrosstabSlice;
export declare const crosstabIsComplete: (plan: CrosstabPlan, slice: CrosstabSlice) => boolean;
export interface CrosstabEmitOptions {
    readonly xMm: number;
    readonly yMm: number;
    readonly slice: CrosstabSlice;
    readonly cornerText: string;
    readonly strokeColour: string;
    readonly textColour: string;
    readonly headerFill: string | null;
}
export declare function emitCrosstab(plan: CrosstabPlan, options: CrosstabEmitOptions): Primitive[];
export {};
