import { ExpressionSandbox } from './jexl.factory';
export interface EvaluationFailure {
    readonly expression: string;
    readonly message: string;
}
export declare class ExpressionEvaluator {
    private readonly engine;
    private readonly cache;
    private readonly failures;
    constructor(engine?: ExpressionSandbox);
    getFailures(): readonly EvaluationFailure[];
    clearFailures(): void;
    evaluate(template: string | undefined | null, context: Record<string, unknown>): unknown;
    evaluateText(template: string | undefined | null, context: Record<string, unknown>): string;
    evaluateCondition(template: string | undefined | null, context: Record<string, unknown>): boolean;
    evaluateNumber(template: string | undefined | null, context: Record<string, unknown>): number;
    static hasExpression(template: string | undefined | null): boolean;
    private evalSegment;
    private recordFailure;
    private compileTemplate;
    private compileExpression;
}
