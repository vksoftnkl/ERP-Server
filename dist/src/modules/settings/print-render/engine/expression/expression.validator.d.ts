import { ExpressionSandbox } from './jexl.factory';
export declare const BUILTIN_ROOT_IDENTIFIERS: readonly ["row", "page", "agg", "ctx", "sys", "group"];
export interface ExpressionIssue {
    readonly path: string;
    readonly expression: string;
    readonly message: string;
}
export declare class ExpressionValidator {
    private readonly engine;
    constructor(engine?: ExpressionSandbox);
    validateTemplateString(template: string | undefined | null, path: string, allowedRoots: ReadonlySet<string>): ExpressionIssue[];
    validateExpression(source: string, path: string, allowedRoots: ReadonlySet<string>): ExpressionIssue[];
    private walk;
}
export declare const buildAllowedRoots: (datasetNames: readonly string[]) => Set<string>;
