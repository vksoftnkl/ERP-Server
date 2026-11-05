"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAllowedRoots = exports.ExpressionValidator = exports.BUILTIN_ROOT_IDENTIFIERS = void 0;
const jexl_factory_1 = require("./jexl.factory");
exports.BUILTIN_ROOT_IDENTIFIERS = [
    'row',
    'page',
    'agg',
    'ctx',
    'sys',
    'group',
];
const TRANSFORM_SET = new Set(jexl_factory_1.TRANSFORM_NAMES);
const EXPRESSION_PATTERN = /\{\{([\s\S]*?)\}\}/g;
class ExpressionValidator {
    engine;
    constructor(engine = jexl_factory_1.expressionEngine) {
        this.engine = engine;
    }
    validateTemplateString(template, path, allowedRoots) {
        if (typeof template !== 'string' || !template.includes('{{')) {
            return [];
        }
        const issues = [];
        const openCount = (template.match(/\{\{/g) ?? []).length;
        const closeCount = (template.match(/\}\}/g) ?? []).length;
        if (openCount !== closeCount) {
            issues.push({
                path,
                expression: template,
                message: `unbalanced expression delimiters (${openCount} '{{' vs ${closeCount} '}}')`,
            });
            return issues;
        }
        EXPRESSION_PATTERN.lastIndex = 0;
        let match = EXPRESSION_PATTERN.exec(template);
        while (match !== null) {
            const source = match[1].trim();
            if (!source) {
                issues.push({ path, expression: template, message: 'empty expression' });
            }
            else {
                issues.push(...this.validateExpression(source, path, allowedRoots));
            }
            match = EXPRESSION_PATTERN.exec(template);
        }
        return issues;
    }
    validateExpression(source, path, allowedRoots) {
        let ast;
        try {
            const compiled = this.engine.compile(source);
            ast = compiled._getAst();
        }
        catch (error) {
            return [
                {
                    path,
                    expression: source,
                    message: error instanceof Error ? error.message : String(error),
                },
            ];
        }
        const issues = [];
        this.walk(ast, source, path, allowedRoots, issues);
        return issues;
    }
    walk(node, source, path, allowedRoots, issues, depth = 0) {
        if (!node || typeof node !== 'object') {
            return;
        }
        if (depth > 100) {
            issues.push({ path, expression: source, message: 'expression nests too deeply' });
            return;
        }
        switch (node.type) {
            case 'Identifier': {
                const isRoot = !node.from && !node.relative;
                const identifierName = typeof node.value === 'string' ? node.value : undefined;
                if (isRoot && identifierName && !allowedRoots.has(identifierName)) {
                    issues.push({
                        path,
                        expression: source,
                        message: `unknown identifier '${identifierName}'. Available: ` +
                            `${[...allowedRoots].sort().join(', ')}`,
                    });
                }
                break;
            }
            case 'FunctionCall': {
                if (node.pool === 'functions') {
                    issues.push({
                        path,
                        expression: source,
                        message: `function calls are not allowed in expressions (found '${node.name ?? '?'}')`,
                    });
                }
                else if (node.name && !TRANSFORM_SET.has(node.name)) {
                    issues.push({
                        path,
                        expression: source,
                        message: `unknown transform '|${node.name}'`,
                    });
                }
                break;
            }
            case 'ObjectLiteral': {
                for (const child of Object.values((node.value ?? {}))) {
                    this.walk(child, source, path, allowedRoots, issues, depth + 1);
                }
                break;
            }
            case 'ArrayLiteral': {
                for (const child of (node.value ?? [])) {
                    this.walk(child, source, path, allowedRoots, issues, depth + 1);
                }
                break;
            }
            default:
                break;
        }
        for (const child of [
            node.subject,
            node.left,
            node.right,
            node.test,
            node.consequent,
            node.alternate,
            node.expr,
            node.from,
        ]) {
            this.walk(child, source, path, allowedRoots, issues, depth + 1);
        }
        for (const child of node.args ?? []) {
            this.walk(child, source, path, allowedRoots, issues, depth + 1);
        }
    }
}
exports.ExpressionValidator = ExpressionValidator;
const buildAllowedRoots = (datasetNames) => new Set([...exports.BUILTIN_ROOT_IDENTIFIERS, ...datasetNames]);
exports.buildAllowedRoots = buildAllowedRoots;
//# sourceMappingURL=expression.validator.js.map