"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSettingSource = exports.APP_SETTING_SCOPE_ID_FIELD = exports.APP_SETTING_SCOPE_ID_FIELDS = exports.APP_SETTING_SCOPE_RANK = exports.AppSettingScope = exports.AppSettingDataType = void 0;
var AppSettingDataType;
(function (AppSettingDataType) {
    AppSettingDataType["BOOL"] = "BOOL";
    AppSettingDataType["INT"] = "INT";
    AppSettingDataType["DECIMAL"] = "DECIMAL";
    AppSettingDataType["TEXT"] = "TEXT";
    AppSettingDataType["UUID"] = "UUID";
    AppSettingDataType["DATE"] = "DATE";
    AppSettingDataType["JSON"] = "JSON";
})(AppSettingDataType || (exports.AppSettingDataType = AppSettingDataType = {}));
var AppSettingScope;
(function (AppSettingScope) {
    AppSettingScope["GLOBAL"] = "GLOBAL";
    AppSettingScope["COMPANY"] = "COMPANY";
    AppSettingScope["BRANCH"] = "BRANCH";
    AppSettingScope["DEVICE"] = "DEVICE";
    AppSettingScope["USER"] = "USER";
})(AppSettingScope || (exports.AppSettingScope = AppSettingScope = {}));
exports.APP_SETTING_SCOPE_RANK = {
    [AppSettingScope.GLOBAL]: 1,
    [AppSettingScope.COMPANY]: 2,
    [AppSettingScope.BRANCH]: 3,
    [AppSettingScope.DEVICE]: 4,
    [AppSettingScope.USER]: 5,
};
exports.APP_SETTING_SCOPE_ID_FIELDS = [
    'asvCompanyId',
    'asvBranchId',
    'asvDeviceId',
    'asvUserId',
];
exports.APP_SETTING_SCOPE_ID_FIELD = {
    [AppSettingScope.GLOBAL]: null,
    [AppSettingScope.COMPANY]: 'asvCompanyId',
    [AppSettingScope.BRANCH]: 'asvBranchId',
    [AppSettingScope.DEVICE]: 'asvDeviceId',
    [AppSettingScope.USER]: 'asvUserId',
};
var AppSettingSource;
(function (AppSettingSource) {
    AppSettingSource["OVERRIDE"] = "OVERRIDE";
    AppSettingSource["DEFAULT"] = "DEFAULT";
})(AppSettingSource || (exports.AppSettingSource = AppSettingSource = {}));
//# sourceMappingURL=app-settings-api.types.js.map