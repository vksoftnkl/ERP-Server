import type { PrintRenderErrorDetail } from '../types/print-render-api.types';
import { PtvParamType } from '../../print-template/print-template.constants';
export interface ParamSpec {
    readonly name: string;
    readonly type: PtvParamType;
    readonly required: boolean;
    readonly label: string;
    readonly defaultValue: unknown;
}
export declare function hasContextDefault(name: string): boolean;
export declare function isServerOwnedParam(name: string): boolean;
export declare class RenderParamError extends Error {
    readonly details: PrintRenderErrorDetail[];
    constructor(message: string, details: PrintRenderErrorDetail[]);
}
export declare function readParamSpecs(raw: unknown): {
    specs: ParamSpec[];
    errors: PrintRenderErrorDetail[];
};
export declare function resolveRenderParams(rawSpecs: unknown, supplied: Readonly<Record<string, unknown>>): Record<string, unknown>;
