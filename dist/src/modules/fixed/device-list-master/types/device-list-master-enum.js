"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceListMasterErrorCode = exports.DevicePlatform = exports.DeviceType = void 0;
var DeviceType;
(function (DeviceType) {
    DeviceType["DESKTOP"] = "Desktop";
    DeviceType["MOBILE"] = "Mobile";
    DeviceType["WEB"] = "Web";
})(DeviceType || (exports.DeviceType = DeviceType = {}));
var DevicePlatform;
(function (DevicePlatform) {
    DevicePlatform["WINDOWS"] = "Windows";
    DevicePlatform["MACOS"] = "macOS";
    DevicePlatform["LINUX"] = "Linux";
    DevicePlatform["ANDROID"] = "Android";
    DevicePlatform["IOS"] = "iOS";
    DevicePlatform["OTHER"] = "Other";
})(DevicePlatform || (exports.DevicePlatform = DevicePlatform = {}));
var DeviceListMasterErrorCode;
(function (DeviceListMasterErrorCode) {
    DeviceListMasterErrorCode["GRID_NOT_CONFIGURED"] = "DEVICE_GRID_NOT_CONFIGURED";
    DeviceListMasterErrorCode["NOT_FOUND"] = "DEVICE_NOT_FOUND";
    DeviceListMasterErrorCode["TYPE_INVALID"] = "DEVICE_TYPE_INVALID";
    DeviceListMasterErrorCode["PLATFORM_INVALID"] = "DEVICE_PLATFORM_INVALID";
    DeviceListMasterErrorCode["UID_REQUIRED"] = "DEVICE_UID_REQUIRED";
    DeviceListMasterErrorCode["UID_DUPLICATE"] = "DEVICE_UID_DUPLICATE";
    DeviceListMasterErrorCode["IN_USE"] = "DEVICE_IN_USE";
})(DeviceListMasterErrorCode || (exports.DeviceListMasterErrorCode = DeviceListMasterErrorCode = {}));
//# sourceMappingURL=device-list-master-enum.js.map