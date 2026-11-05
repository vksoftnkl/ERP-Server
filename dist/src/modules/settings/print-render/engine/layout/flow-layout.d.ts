import { CrosstabElement, ReportElement } from '../../definition/template-definition.schema';
export declare const FLOW_EPSILON_MM = 0.01;
export interface FlowShift {
    readonly atMm: number;
    readonly deltaMm: number;
}
export interface FlowLayout {
    readonly elements: readonly ReportElement[];
    readonly heightMm: number;
    readonly shifts: readonly FlowShift[];
}
export declare function verticalSpan(element: ReportElement): readonly [number, number];
export declare function applyFlowLayout(band: {
    readonly heightMm: number;
    readonly elements: readonly ReportElement[];
}, isVisible: (element: ReportElement) => boolean, crosstabHeightMm: (element: CrosstabElement) => number): FlowLayout;
