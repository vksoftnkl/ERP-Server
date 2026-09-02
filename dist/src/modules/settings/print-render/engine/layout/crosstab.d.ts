import { CrosstabElement } from '../../definition/template-definition.schema';
import { Primitive } from './layout-tree.types';
import { MeasuredFont } from './text-measure';
export declare const CROSSTAB_FOLD_KEY = "\u001Fcrosstab-fold";
export declare const CROSSTAB_TOTALS_KEY = "\u001Fcrosstab-total";
export interface CrosstabColumn {
    readonly key: string;
    readonly label: string;
}
export interface CrosstabModelRow {
    readonly key: string;
    readonly label: string;
    readonly values: readonly (number | null)[];
    readonly total: number | null;
}
export interface CrosstabModel {
    readonly columns: readonly CrosstabColumn[];
    readonly rows: readonly CrosstabModelRow[];
    readonly columnTotals: readonly (number | null)[];
    readonly grandTotal: number | null;
    readonly sourceRows: number;
    readonly droppedColumns: number;
}
export interface CrosstabRowReader {
    text(expression: string, row: unknown, index: number, total: number): string;
    number(expression: string, row: unknown, index: number, total: number): number;
}
export declare function buildCrosstabModel(element: CrosstabElement, rows: readonly unknown[], reader: CrosstabRowReader): CrosstabModel;
export interface PlannedColumn {
    readonly key: string;
    readonly label: string;
    readonly xMm: number;
    readonly wMm: number;
    readonly modelIndex: number | null;
}
export interface CrosstabPlan {
    readonly element: CrosstabElement;
    readonly model: CrosstabModel;
    readonly rowHeaderWidthMm: number;
    readonly columns: readonly PlannedColumn[];
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
