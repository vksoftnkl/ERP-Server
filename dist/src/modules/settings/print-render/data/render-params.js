"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderParamError = void 0;
exports.hasContextDefault = hasContextDefault;
exports.isServerOwnedParam = isServerOwnedParam;
exports.readParamSpecs = readParamSpecs;
exports.resolveRenderParams = resolveRenderParams;
const print_template_constants_1 = require("../../print-template/print-template.constants");
const scalar_text_1 = require("./scalar-text");
function hasContextDefault(name) {
    return print_template_constants_1.PTV_CONTEXT_PARAMS.includes(name);
}
function isServerOwnedParam(name) {
    return print_template_constants_1.PTV_SERVER_OWNED_PARAMS.includes(name);
}
class RenderParamError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.details = details;
        this.name = 'RenderParamError';
    }
}
exports.RenderParamError = RenderParamError;
function readParamSpecs(raw) {
    const errors = [];
    const specs = [];
    if (raw === null || raw === undefined)
        return { specs, errors };
    if (!Array.isArray(raw)) {
        errors.push({
            field: 'ptvParams',
            message: `ptvParams must be a JSON array of prompts; this revision holds ${typeof raw}.`,
        });
        return { specs, errors };
    }
    for (const [index, entry] of raw.entries()) {
        const path = `ptvParams[${index}]`;
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            errors.push({ field: path, message: 'Each prompt must be an object.' });
            continue;
        }
        const record = entry;
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        if (!print_template_constants_1.PTV_PARAM_NAME_PATTERN.test(name)) {
            errors.push({
                field: `${path}.name`,
                message: `'${name}' is not a usable prompt name — lower case, starting with a letter, ${'letters, digits and underscores only'}.`,
            });
            continue;
        }
        const type = typeof record.type === 'string' ? record.type.toUpperCase() : 'TEXT';
        if (!print_template_constants_1.PTV_PARAM_TYPES.includes(type)) {
            errors.push({
                field: `${path}.type`,
                message: `'${String(record.type)}' is not a prompt type. One of: ${print_template_constants_1.PTV_PARAM_TYPES.join(', ')}.`,
            });
            continue;
        }
        specs.push({
            name,
            type: type,
            required: record.required === true,
            label: typeof record.label === 'string' && record.label ? record.label : name,
            defaultValue: record.default ?? record.defaultValue ?? null,
        });
    }
    return { specs, errors };
}
function coerce(spec, value, errors) {
    if (value === null || value === undefined || value === '')
        return null;
    switch (spec.type) {
        case 'NUMBER': {
            const parsed = typeof value === 'number' ? value : Number((0, scalar_text_1.toScalarText)(value).trim());
            if (!Number.isFinite(parsed)) {
                errors.push({
                    field: `params.${spec.name}`,
                    message: `'${spec.label}' expects a number; got '${(0, scalar_text_1.toScalarText)(value)}'.`,
                });
                return null;
            }
            return parsed;
        }
        case 'BOOLEAN':
            return typeof value === 'boolean'
                ? value
                : /^(true|1|yes|y)$/i.test((0, scalar_text_1.toScalarText)(value).trim());
        case 'DATE': {
            const text = (0, scalar_text_1.toScalarText)(value).trim();
            const iso = /^\d{4}-\d{2}-\d{2}/.exec(text);
            if (!iso) {
                errors.push({
                    field: `params.${spec.name}`,
                    message: `'${spec.label}' expects a date as YYYY-MM-DD; got '${text}'.`,
                });
                return null;
            }
            return iso[0];
        }
        case 'DATETIME': {
            const parsed = value instanceof Date ? value : new Date((0, scalar_text_1.toScalarText)(value));
            if (Number.isNaN(parsed.getTime())) {
                errors.push({
                    field: `params.${spec.name}`,
                    message: `'${spec.label}' expects a date and time; got '${(0, scalar_text_1.toScalarText)(value)}'.`,
                });
                return null;
            }
            return parsed.toISOString();
        }
        case 'UUID': {
            const text = (0, scalar_text_1.toScalarText)(value).trim();
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)) {
                errors.push({
                    field: `params.${spec.name}`,
                    message: `'${spec.label}' expects an id; got '${text}'.`,
                });
                return null;
            }
            return text;
        }
        default:
            return (0, scalar_text_1.toScalarText)(value);
    }
}
function resolveRenderParams(rawSpecs, supplied) {
    const { specs, errors } = readParamSpecs(rawSpecs);
    const declared = new Set(specs.map((spec) => spec.name));
    for (const name of Object.keys(supplied)) {
        if (isServerOwnedParam(name)) {
            errors.push({
                field: `params.${name}`,
                message: `'${name}' is the server's to decide — it comes from the authenticated session and ` +
                    'cannot be sent with the request. Declaring it as a prompt is allowed; answering it ' +
                    'is not.',
            });
            continue;
        }
        if (declared.has(name))
            continue;
        errors.push({
            field: `params.${name}`,
            message: `This revision has no prompt named '${name}'. It asks for: ${specs.map((spec) => spec.name).join(', ') || 'nothing'}.`,
        });
    }
    const values = {};
    for (const spec of specs) {
        const answer = Object.prototype.hasOwnProperty.call(supplied, spec.name)
            ? supplied[spec.name]
            : spec.defaultValue;
        const coerced = coerce(spec, answer, errors);
        if (coerced === null && spec.required && !hasContextDefault(spec.name)) {
            errors.push({
                field: `params.${spec.name}`,
                message: `'${spec.label}' is required by this revision and was not answered.`,
            });
        }
        values[spec.name] = coerced;
    }
    if (errors.length > 0) {
        throw new RenderParamError('The render parameters are not what this revision asks for', errors);
    }
    return values;
}
//# sourceMappingURL=render-params.js.map