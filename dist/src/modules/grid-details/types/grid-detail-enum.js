"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridDetailErrorCode = exports.gridDeviceTypeEnum = void 0;
var gridDeviceTypeEnum;
(function (gridDeviceTypeEnum) {
    gridDeviceTypeEnum["DESKTOP"] = "desktop";
    gridDeviceTypeEnum["MOBILE"] = "mobile";
    gridDeviceTypeEnum["WEB"] = "web";
})(gridDeviceTypeEnum || (exports.gridDeviceTypeEnum = gridDeviceTypeEnum = {}));
var GridDetailErrorCode;
(function (GridDetailErrorCode) {
    GridDetailErrorCode["NOT_FOUND"] = "GRID_NOT_FOUND";
    GridDetailErrorCode["COLUMN_NOT_FOUND"] = "GRID_COLUMN_NOT_FOUND";
    GridDetailErrorCode["ID_INVALID"] = "GRID_ID_INVALID";
    GridDetailErrorCode["COLUMN_ID_INVALID"] = "GRID_COLUMN_ID_INVALID";
    GridDetailErrorCode["COLUMN_NAME_REQUIRED"] = "GRID_COLUMN_NAME_REQUIRED";
    GridDetailErrorCode["SQL_NO_FROM_TABLE"] = "GRID_SQL_NO_FROM_TABLE";
    GridDetailErrorCode["SQL_INVALID"] = "GRID_SQL_INVALID";
})(GridDetailErrorCode || (exports.GridDetailErrorCode = GridDetailErrorCode = {}));
//# sourceMappingURL=grid-detail-enum.js.map