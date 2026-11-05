"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressionEvaluator = void 0;
const jexl_factory_1 = require("./jexl.factory");
const scalar_1 = require("./transforms/scalar");
const EXPRESSION_PATTERN = /\{\{([\s\S]*?)\}\}/g;
const MAX_CACHE_ENTRIES = 5_000;
class ExpressionEvaluator {
    engine;
    cache = new Map();
    failures = [];
    constructor(engine = jexl_factory_1.expressionEngine) {
        this.engine = engine;
    }
    getFailures() {
        return this.failures;
    }
    clearFailures() {
        this.failures.length = 0;
    }
    evaluate(template, context) {
        if (template === undefined || template === null || template === '') {
            return '';
        }
        const compiled = this.compileTemplate(template);
        if (compiled.singleExpression) {
            const segment = compiled.segments[0];
            return segment.kind === 'expression' ? this.evalSegment(segment, context) : segment.text;
        }
        let output = '';
        for (const segment of compiled.segments) {
            if (segment.kind === 'literal') {
                output += segment.text;
                continue;
            }
            const value = this.evalSegment(segment, context);
            output += (0, scalar_1.scalarToString)(value);
        }
        return output;
    }
    evaluateText(template, context) {
        const value = this.evaluate(template, context);
        if (value === null || value === undefined) {
            return '';
        }
        return (0, scalar_1.scalarToString)(value);
    }
    evaluateCondition(template, context) {
        if (template === undefined || template === null || template.trim() === '') {
            return true;
        }
        const value = this.evaluate(template, context);
        if (typeof value === 'string') {
            const normalised = value.trim().toLowerCase();
            return normalised !== '' && normalised !== 'false' && normalised !== '0';
        }
        return Boolean(value);
    }
    evaluateNumber(template, context) {
        const value = this.evaluate(template, context);
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }
        const text = (0, scalar_1.scalarToString)(value).trim();
        if (!text) {
            return 0;
        }
        const parenthesised = /^\(.*\)$/.test(text);
        const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
        if (!match) {
            return 0;
        }
        const numeric = Number(match[0]);
        if (!Number.isFinite(numeric)) {
            return 0;
        }
        return parenthesised ? -Math.abs(numeric) : numeric;
    }
    static hasExpression(template) {
        return typeof template === 'string' && template.includes('{{');
    }
    evalSegment(segment, context) {
        if (!segment.compiled) {
            return '';
        }
        try {
            return segment.compiled.evalSync(context);
        }
        catch (error) {
            this.recordFailure(segment.source, error);
            return '';
        }
    }
    recordFailure(expression, error) {
        if (this.failures.length >= 50) {
            return;
        }
        if (this.failures.some((failure) => failure.expression === expression)) {
            return;
        }
        this.failures.push({
            expression,
            message: error instanceof Error ? error.message : String(error),
        });
    }
    compileTemplate(template) {
        const cached = this.cache.get(template);
        if (cached) {
            return cached;
        }
        const segments = [];
        let cursor = 0;
        EXPRESSION_PATTERN.lastIndex = 0;
        let match = EXPRESSION_PATTERN.exec(template);
        while (match !== null) {
            if (match.index > cursor) {
                segments.push({ kind: 'literal', text: template.slice(cursor, match.index) });
            }
            const source = match[1].trim();
            segments.push({ kind: 'expression', source, compiled: this.compileExpression(source) });
            cursor = match.index + match[0].length;
            match = EXPRESSION_PATTERN.exec(template);
        }
        if (cursor < template.length) {
            segments.push({ kind: 'literal', text: template.slice(cursor) });
        }
        if (segments.length === 0) {
            segments.push({ kind: 'literal', text: '' });
        }
        const compiled = {
            segments,
            singleExpression: segments.length === 1 && segments[0].kind === 'expression',
        };
        if (this.cache.size < MAX_CACHE_ENTRIES) {
            this.cache.set(template, compiled);
        }
        return compiled;
    }
    compileExpression(source) {
        if (!source) {
            return null;
        }
        try {
            return this.engine.compile(source);
        }
        catch (error) {
            this.recordFailure(source, error);
            return null;
        }
    }
}
exports.ExpressionEvaluator = ExpressionEvaluator;
//# sourceMappingURL=expression.evaluator.js.map