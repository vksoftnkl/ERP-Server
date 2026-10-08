"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCastableToDataType = isCastableToDataType;
exports.validateSettingValue = validateSettingValue;
exports.toAllowedValues = toAllowedValues;
exports.isScopeWithinMax = isScopeWithinMax;
const DtoTransforms_1 = require("../../../common/dto/DtoTransforms");
const app_settings_api_types_1 = require("./types/app-settings-api.types");
const BOOL_LITERALS = new Set([
    'true',
    'false',
    't',
    'f',
    'yes',
    'no',
    'y',
    'n',
    'on',
    'off',
    '1',
    '0',
]);
const INT_PATTERN = /^[+-]?\d+$/;
const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function isCastableToDataType(value, dataType) {
    switch (dataType) {
        case app_settings_api_types_1.AppSettingDataType.BOOL:
            return BOOL_LITERALS.has(value.trim().toLowerCase());
        case app_settings_api_types_1.AppSettingDataType.INT:
            return INT_PATTERN.test(value.trim());
        case app_settings_api_types_1.AppSettingDataType.DECIMAL:
            return DECIMAL_PATTERN.test(value.trim()) && Number.isFinite(Number(value.trim()));
        case app_settings_api_types_1.AppSettingDataType.UUID:
            return DtoTransforms_1.UUID_PATTERN.test(value.trim());
        case app_settings_api_types_1.AppSettingDataType.DATE:
            return DATE_PATTERN.test(value.trim()) && !Number.isNaN(Date.parse(value.trim()));
        case app_settings_api_types_1.AppSettingDataType.JSON:
            try {
                JSON.parse(value);
                return true;
            }
            catch {
                return false;
            }
        case app_settings_api_types_1.AppSettingDataType.TEXT:
        default:
            return true;
    }
}
function validateSettingValue(value, rules, field) {
    if (value === null || value === undefined) {
        return [];
    }
    if (!isCastableToDataType(value, rules.asdDataType)) {
        return [
            {
                field,
                message: `"${value}" is not a valid ${rules.asdDataType} for setting "${rules.asdKey}"`,
            },
        ];
    }
    const details = [];
    if (rules.asdAllowedValues && !rules.asdAllowedValues.includes(value)) {
        details.push({
            field,
            message: `"${value}" is not one of the allowed values for setting "${rules.asdKey}" ` +
                `(${rules.asdAllowedValues.join(', ')})`,
        });
    }
    if (rules.asdDataType === app_settings_api_types_1.AppSettingDataType.INT ||
        rules.asdDataType === app_settings_api_types_1.AppSettingDataType.DECIMAL) {
        const numeric = Number(value.trim());
        if (rules.asdMinValue !== null && numeric < rules.asdMinValue) {
            details.push({
                field,
                message: `${numeric} is below the minimum ${rules.asdMinValue} for setting "${rules.asdKey}"`,
            });
        }
        if (rules.asdMaxValue !== null && numeric > rules.asdMaxValue) {
            details.push({
                field,
                message: `${numeric} is above the maximum ${rules.asdMaxValue} for setting "${rules.asdKey}"`,
            });
        }
    }
    return details;
}
function toAllowedValues(raw) {
    if (!Array.isArray(raw)) {
        return null;
    }
    const values = raw.filter((value) => typeof value === 'string');
    return values.length > 0 ? values : null;
}
function isScopeWithinMax(scope, maxScope) {
    return app_settings_api_types_1.APP_SETTING_SCOPE_RANK[scope] <= app_settings_api_types_1.APP_SETTING_SCOPE_RANK[maxScope];
}
//# sourceMappingURL=app-settings.validation.js.map