"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesiseSampleRows = exports.findDuplicateColumns = exports.introspectFields = exports.fieldTypeForOid = exports.humaniseColumnName = void 0;
const OID_TO_FIELD_TYPE = new Map([
    [16, 'boolean'],
    [20, 'integer'],
    [21, 'integer'],
    [23, 'integer'],
    [26, 'integer'],
    [700, 'number'],
    [701, 'number'],
    [790, 'number'],
    [1700, 'number'],
    [1082, 'date'],
    [1114, 'datetime'],
    [1184, 'datetime'],
    [114, 'object'],
    [3802, 'object'],
]);
const DEFAULT_FORMAT = {
    number: '#,##0.00',
    date: 'dd-MM-yyyy',
    datetime: 'dd-MM-yyyy HH:mm',
};
const humaniseColumnName = (name) => {
    const spaced = name
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
    if (spaced === '') {
        return name;
    }
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};
exports.humaniseColumnName = humaniseColumnName;
const fieldTypeForOid = (dataTypeId) => OID_TO_FIELD_TYPE.get(dataTypeId) ?? 'string';
exports.fieldTypeForOid = fieldTypeForOid;
const introspectFields = (descriptors, overrides = []) => {
    const overrideByName = new Map(overrides.map((field) => [field.name, field]));
    const seen = new Set();
    const fields = [];
    for (const descriptor of descriptors) {
        if (seen.has(descriptor.name)) {
            continue;
        }
        seen.add(descriptor.name);
        const type = (0, exports.fieldTypeForOid)(descriptor.dataTypeID);
        const override = overrideByName.get(descriptor.name);
        fields.push({
            name: descriptor.name,
            type,
            label: override?.label ?? (0, exports.humaniseColumnName)(descriptor.name),
            ...(override?.format ?? DEFAULT_FORMAT[type]
                ? { format: override?.format ?? DEFAULT_FORMAT[type] }
                : {}),
            ...(override?.complexScript ? { complexScript: true } : {}),
            ...(override?.description ? { description: override.description } : {}),
        });
    }
    return fields;
};
exports.introspectFields = introspectFields;
const findDuplicateColumns = (descriptors) => {
    const counts = new Map();
    for (const descriptor of descriptors) {
        counts.set(descriptor.name, (counts.get(descriptor.name) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
};
exports.findDuplicateColumns = findDuplicateColumns;
const synthesiseSampleRows = (fields, rowCount) => Array.from({ length: Math.max(1, rowCount) }, (_unused, index) => {
    const row = {};
    for (const field of fields) {
        row[field.name] = sampleValueFor(field, index);
    }
    return row;
});
exports.synthesiseSampleRows = synthesiseSampleRows;
const sampleValueFor = (field, index) => {
    switch (field.type) {
        case 'boolean':
            return index % 2 === 0;
        case 'integer':
            return index + 1;
        case 'number':
            return Number((100 * (index + 1) + 0.5).toFixed(2));
        case 'date':
            return `2026-0${(index % 9) + 1}-15`;
        case 'datetime':
            return `2026-0${(index % 9) + 1}-15T10:30:00.000Z`;
        case 'object':
            return {};
        default:
            return `${field.label} ${index + 1}`;
    }
};
//# sourceMappingURL=dataset-field.introspector.js.map