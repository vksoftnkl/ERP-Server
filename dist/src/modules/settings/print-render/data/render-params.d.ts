import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
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
    readonly details: ModuleErrorDetail[];
    constructor(message: string, details: ModuleErrorDetail[]);
}
export declare function readParamSpecs(raw: unknown): {
    specs: ParamSpec[];
    errors: ModuleErrorDetail[];
};
export declare function resolveRenderParams(rawSpecs: unknown, supplied: Readonly<Record<string, unknown>>): Record<string, unknown>;
