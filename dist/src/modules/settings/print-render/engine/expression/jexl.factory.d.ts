import jexl = require('jexl');
export type ExpressionSandbox = InstanceType<typeof jexl.Jexl>;
export declare const TRANSFORM_NAMES: readonly ["fmt", "fmtIntl", "date", "numToWords", "intToWords", "gstSplit", "gstExclusive", "interState", "upper", "lower", "trim", "title", "pad", "padEnd", "padCenter", "truncate", "repeat", "coalesce", "wrap", "mask", "abs", "round", "ceil", "floor", "neg", "default", "length", "join", "first", "last", "sum", "sortBy", "where", "groupIndian", "groupWestern", "bool", "num", "str"];
export type TransformName = (typeof TRANSFORM_NAMES)[number];
export declare const createExpressionEngine: () => ExpressionSandbox;
export declare const expressionEngine: ExpressionSandbox;
